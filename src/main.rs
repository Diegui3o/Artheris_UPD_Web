use std::net::SocketAddr;
use std::str;
use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

mod config;
mod ws_server;

use crate::ws_server::{start_ws_server, WsContext};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Canal broadcast para compartir mensajes con WebSocket
    let (tx, _) = broadcast::channel::<String>(100);

    // 🔹 Configuración UDP (PC escucha en 8889; ESP32 escucha en 8888)
    const LOCAL_PORT: u16 = 8889;                 // Puerto local de la PC (recibir telemetría)
    const REMOTE_IP: &str = "192.168.1.50"; // la IP fija del ESP32
    const REMOTE_PORT: u16 = 8888;          // ESP32 escucha aquí

    let local_addr = format!("0.0.0.0:{}", LOCAL_PORT);
    let remote_addr: SocketAddr = format!("{}:{}", REMOTE_IP, REMOTE_PORT).parse().unwrap();

    // Bind UDP local
    let socket = Arc::new(UdpSocket::bind(local_addr.clone()).await?);
    println!("✅ UDP listening on {}", local_addr);

    // 🔹 Lanzar servidor WebSocket con contexto real (socket + remote_addr)
    let ws_ctx = WsContext {
        tx: tx.clone(),
        esp32_socket: Some(socket.clone()),
        remote_addr,                       
    };
    tokio::spawn(start_ws_server(ws_ctx));

    // 🔹 Tarea para recibir UDP (telemetría) y mandarla al WebSocket
    let socket_recv = Arc::clone(&socket);
    let tx_udp = tx.clone();
    tokio::spawn(async move {
        let mut buf = vec![0u8; 4096];
        loop {
            match socket_recv.recv_from(&mut buf).await {
                Ok((len, src)) => {
                    if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                        // ¿Es JSON? ¿Qué type trae?
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                            match v.get("type").and_then(|t| t.as_str()) {
                                Some("ack") => {
                                    // ✅ Reenvía el ACK tal cual al WS (sin envolver)
                                    let _ = tx_udp.send(v.to_string());
                                }
                                Some("telemetry") => {
                                    // Si ESP32 manda telemetría con su propio envelope
                                    let _ = tx_udp.send(v.to_string());
                                }
                                _ => {
                                    // Telemetría cruda → envuélvela
                                    let wrapped = format!(r#"{{"type":"telemetry","payload":{}}}"#, text);
                                    let _ = tx_udp.send(wrapped);
                                }
                            }
                        } else {
                            // No es JSON: lo tratamos como telemetría cruda
                            let wrapped = format!(r#"{{"type":"telemetry","payload":"{}"}}"#, text);
                            let _ = tx_udp.send(wrapped);
                        }
                    }
                }
                Err(e) => { eprintln!("❌ UDP recv error: {}", e); break; }
            }
        }
    });

    // 🔹 Enviar comandos manuales desde stdin al ESP32 (útil para pruebas)
    let stdin = BufReader::new(tokio::io::stdin());
    let mut lines = stdin.lines();

    println!("Escribe un mensaje para enviar al ESP32 (exit para salir):");
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().eq_ignore_ascii_case("exit") {
            println!("👋 Saliendo...");
            break;
        }
        // Envía lo escrito tal cual (puedes escribir JSON tipo {"type":"command","payload":{"led":true}})
        if let Err(e) = socket.send_to(line.as_bytes(), &remote_addr).await {
            eprintln!("❌ Error enviando: {}", e);
        } else {
            println!("📤 Sent to {} -> {}", remote_addr, line);
        }
    }

    Ok(())
}
