use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::{accept_async, tungstenite::Message};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use serde_json::Value;

// Importa tus helpers
use crate::config::function::{set_led_all, set_motors_state, set_mode};

pub struct WsContext {
    pub tx: broadcast::Sender<String>,
    pub esp32_socket: Option<Arc<UdpSocket>>,
    pub remote_addr: SocketAddr,
}

#[derive(Debug, Deserialize)]
struct LedOne {
    id: u32,
    state: bool,
}

#[derive(Debug, Deserialize)]
struct LedMany {
    ids: Vec<u32>,
    state: bool,
}

#[derive(Debug, Deserialize)]
struct Payload {
    mode: Option<i32>,
    motors: Option<bool>,
    // Antes era Option<bool>; ahora aceptamos bool (all) u objeto (one)
    led: Option<Value>,
    // Opcional: soporta "many"
    leds: Option<LedMany>,
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
                                // 1) Normaliza y reenvía según el formato (nuevo, directo o legacy)
                                if let Err(e) = handle_incoming(&text, sock.clone(), raddr, &tx_ws).await {
                                    eprintln!("❌ handle_incoming error: {e:?}");
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
    let root: serde_json::Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => {
            // No es JSON → (opcional) sólo re-publica
            let _ = ws_tx.send(text.to_string());
            return Ok(());
        }
    };
    // Soporta dos layouts:
    // A) {"type":"command","request_id":"...","payload":{ ...comando... }}
    // B) {"type":"command","payload":{"request_id":"...","payload":{ ...comando... }}}
    let kind = root.get("type").and_then(|v| v.as_str());

    // Extrae request_id (top-level o dentro de payload)
    let req_id_top = root.get("request_id").and_then(|v| v.as_str());
    let req_id_in_payload = root
        .get("payload")
        .and_then(|p| p.get("request_id"))
        .and_then(|v| v.as_str());
    let req_id = req_id_top.or(req_id_in_payload);

    // Comando "normalizado": puede estar en root.payload o en root.payload.payload
    let payload_top = root.get("payload");
    let payload_inner = payload_top.and_then(|p| p.get("payload"));
    let command_node = payload_inner.or(payload_top); // prefiero el inner si existe

    // También soportamos los otros formatos (directo o legacy) a través de Envelope
    let env = serde_json::from_value::<Envelope>(root.clone()).ok();

    // --- Si es JSON con type:"command" y hay nodo de comando, procesa aquí ---
    if matches!(kind, Some("command")) {
        if let Some(cmd) = command_node {
            // cmd puede tener: { led: bool | {id,state}, leds:{ids,state}, mode:int, motors:bool }

            // leds many
            if let Some(leds_node) = cmd.get("leds") {
                if let Ok(many) = serde_json::from_value::<LedMany>(leds_node.clone()) {
                    crate::config::function::set_led_many(
                        &many.ids,
                        many.state,
                        esp32_socket.clone(),
                        remote_addr,
                        ws_tx,
                        req_id
                    ).await;
                    return Ok(());
                }
            }

            // led all / one
            if let Some(led_node) = cmd.get("led") {
                if let Some(all) = led_node.as_bool() {
                    set_led_all(all, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                    return Ok(());
                }
                if let Ok(one) = serde_json::from_value::<LedOne>(led_node.clone()) {
                    crate::config::function::set_led_one(
                        one.id,
                        one.state,
                        esp32_socket.clone(),
                        remote_addr,
                        ws_tx,
                        req_id
                    ).await;
                    return Ok(());
                }
            }

            // mode
            if let Some(m) = cmd.get("mode").and_then(|v| v.as_i64()) {
                set_mode(&m.to_string(), esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                return Ok(());
            }

            // motors
            if let Some(motors) = cmd.get("motors").and_then(|v| v.as_bool()) {
                set_motors_state(motors, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                return Ok(());
            }

            // Si no reconocimos campos → passthrough prudente
            if let Some(sock) = &esp32_socket {
                sock.send_to(text.as_bytes(), remote_addr).await?;
            }
            return Ok(());
        }
    }

    // --- También soporta formatos alternativos vía Envelope ---
    if let Some(env) = env {
        if matches!(env.kind.as_deref(), Some("command")) {
            if let Some(p) = env.payload {
                if let Some(m) = p.mode {
                    set_mode(&m.to_string(), esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                    return Ok(());
                }
                if let Some(motors) = p.motors {
                    set_motors_state(motors, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                    return Ok(());
                }
                if let Some(many) = p.leds {
                    crate::config::function::set_led_many(&many.ids, many.state, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                    return Ok(());
                }
                if let Some(led_val) = p.led {
                    if let Some(all) = led_val.as_bool() {
                        set_led_all(all, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                        return Ok(());
                    }
                    if let Ok(one) = serde_json::from_value::<LedOne>(led_val) {
                        crate::config::function::set_led_one(one.id, one.state, esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
                        return Ok(());
                    }
                }
            }
        }

        if let Some(m) = env.mode {
            set_mode(&m.to_string(), esp32_socket.clone(), remote_addr, ws_tx, req_id).await;
            return Ok(());
        }

        if let Some(cmd) = env.command.as_deref() {
            match cmd {
                "ON_LED"     => set_led_all(true,  esp32_socket.clone(), remote_addr, ws_tx, req_id).await,
                "OFF_LED"    => set_led_all(false, esp32_socket.clone(), remote_addr, ws_tx, req_id).await,
                "ON_MOTORS"  => set_motors_state(true,  esp32_socket.clone(), remote_addr, ws_tx, req_id).await,
                "OFF_MOTORS" => set_motors_state(false, esp32_socket.clone(), remote_addr, ws_tx, req_id).await,
                _ => {
                    if let Some(sock) = &esp32_socket {
                        sock.send_to(text.as_bytes(), remote_addr).await?;
                    }
                }
            }
            return Ok(());
        }
    }

    // JSON válido pero no reconocido → passthrough
    if let Some(sock) = &esp32_socket {
        sock.send_to(text.as_bytes(), remote_addr).await?;
    }
    Ok(())
}