use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;

// Importa tus helpers
use crate::config::function::{set_led_state, set_motors_state, set_mode};

pub struct WsContext {
    pub tx: broadcast::Sender<String>,
    pub esp32_socket: Option<Arc<UdpSocket>>,
    pub remote_addr: SocketAddr,
}

#[derive(Debug, Deserialize)]
struct Payload {
    // `mode` puede venir como número; lo hacemos Option<i32>
    mode: Option<i32>,
    led: Option<bool>,
    motors: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Envelope {
    #[serde(rename = "type")]
    kind: Option<String>,
    payload: Option<Payload>,
    // Soportar formato directo `{"mode":1}`
    mode: Option<i32>,
    // Soportar formato antiguo `{"command":"ON_LED"}`
    command: Option<String>,
}

pub async fn start_ws_server(ctx: WsContext) {
    let listener = TcpListener::bind("0.0.0.0:9001").await.unwrap();
    println!("🌐 WebSocket server listening on ws://0.0.0.0:9001");

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                let mut rx = ctx.tx.subscribe();
                let tx_ws = ctx.tx.clone();
                let sock = ctx.esp32_socket.clone();
                let raddr = ctx.remote_addr;

                tokio::spawn(async move {
                    let ws = accept_async(stream).await.unwrap();
                    let (mut ws_sender, mut ws_receiver) = ws.split();

                    // broadcast -> este cliente
                    let mut rx_task = tokio::spawn(async move {
                        while let Ok(text) = rx.recv().await {
                            if ws_sender.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                    });

                    // este cliente -> (broadcast y) UDP ESP32
                    let mut recv_task = tokio::spawn(async move {
                        while let Some(Ok(msg)) = ws_receiver.next().await {
                            if let Message::Text(text) = msg {
                                // Re-broadcast a otros clientes
                                let _ = tx_ws.send(text.clone());
                                // Enviar a ESP32 por UDP
                                if let Some(sock) = &sock {
                                    if let Err(e) = sock.send_to(text.as_bytes(), raddr).await {
                                        eprintln!("❌ UDP send error: {e}");
                                    }
                                } else {
                                    eprintln!("⚠️ WsContext sin UDP socket; no puedo reenviar al ESP32");
                                }
                            }
                        }
                    });

                    tokio::select! {
                        _ = (&mut rx_task) => recv_task.abort(),
                        _ = (&mut recv_task) => rx_task.abort(),
                    }
                });
            }
            Err(e) => eprintln!("❌ WS accept error: {}", e),
        }
    }
}

async fn handle_incoming(
    text: &str,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
) -> anyhow::Result<()> {
    // Intenta parsear como Envelope
    match serde_json::from_str::<Envelope>(text) {
        Ok(env) => {
            // 1) Formato nuevo: {"type":"command","payload":{...}}
            if matches!(env.kind.as_deref(), Some("command")) {
                if let Some(p) = env.payload {
                    if let Some(m) = p.mode {
                        // Tu helper set_mode espera &str, lo convertimos
                        set_mode(&m.to_string(), esp32_socket.clone(), remote_addr, ws_tx).await;
                    }
                    if let Some(led) = p.led {
                        set_led_state(led, esp32_socket.clone(), remote_addr, ws_tx).await;
                    }
                    if let Some(motors) = p.motors {
                        set_motors_state(motors, esp32_socket.clone(), remote_addr, ws_tx).await;
                    }
                }
                return Ok(());
            }

            // 2) Formato directo: {"mode": 0|1|2}
            if let Some(m) = env.mode {
                set_mode(&m.to_string(), esp32_socket.clone(), remote_addr, ws_tx).await;
                return Ok(());
            }

            // 3) Formato antiguo: {"command":"ON_LED"|"OFF_LED"|"ON_MOTORS"|"OFF_MOTORS"}
            if let Some(cmd) = env.command.as_deref() {
                match cmd {
                    "ON_LED" => set_led_state(true, esp32_socket.clone(), remote_addr, ws_tx).await,
                    "OFF_LED" => set_led_state(false, esp32_socket.clone(), remote_addr, ws_tx).await,
                    "ON_MOTORS" => set_motors_state(true, esp32_socket.clone(), remote_addr, ws_tx).await,
                    "OFF_MOTORS" => set_motors_state(false, esp32_socket.clone(), remote_addr, ws_tx).await,
                    _ => {}
                }
                return Ok(());
            }

            // Si no coincide ningún formato, solo re-publica el texto (opcional)
            let _ = ws_tx.send(text.to_string());
            Ok(())
        }
        Err(_) => {
            // No es JSON válido -> re-publica tal cual
            let _ = ws_tx.send(text.to_string());
            Ok(())
        }
    }
}
