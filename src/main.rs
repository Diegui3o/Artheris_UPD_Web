use std::net::SocketAddr;
use std::str;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

mod ws_server;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Canal broadcast para compartir mensajes con WebSocket
    let (tx, _) = broadcast::channel::<String>(100);

    // 🔹 Lanzar servidor WebSocket
    tokio::spawn(ws_server::start_ws_server(tx.clone()));

    // 🔹 Configuración UDP
    const LOCAL_PORT: u16 = 8889; // Puerto donde escucha la PC
    const REMOTE_IP: &str = "192.168.1.30"; // IP fija del ESP32
    const REMOTE_PORT: u16 = 8888;

    let local_addr = format!("0.0.0.0:{}", LOCAL_PORT);
    let remote_addr: SocketAddr = format!("{}:{}", REMOTE_IP, REMOTE_PORT).parse().unwrap();

    // Clona local_addr para usarlo en el println después del bind
    let socket = Arc::new(UdpSocket::bind(local_addr.clone()).await?);
    println!("✅ UDP listening on {}", local_addr);

    let tx_udp = tx.clone();

    // 🔹 Tarea para recibir UDP y mandar al WebSocket
    let socket_recv = Arc::clone(&socket);
    tokio::spawn(async move {
        let mut buf = vec![0u8; 1024];
        loop {
            match socket_recv.recv_from(&mut buf).await {
                Ok((len, _src)) => {
                    if let Ok(text) = str::from_utf8(&buf[..len]) {
                        //println!("📩 From {} -> {}", src, text);
                        let _ = tx_udp.send(text.to_string()); // Manda al WS
                    }
                }
                Err(e) => {
                    eprintln!("❌ UDP recv error: {}", e);
                    break;
                }
            }
        }
    });

    // 🔹 Enviar desde stdin al ESP32
    let stdin = BufReader::new(tokio::io::stdin());
    let mut lines = stdin.lines();

    println!("Escribe un mensaje para enviar al ESP32 (exit para salir):");
    while let Ok(Some(line)) = lines.next_line().await {
        if line.to_lowercase() == "exit" {
            println!("👋 Saliendo...");
            break;
        }
        if let Err(e) = socket.send_to(line.as_bytes(), &remote_addr).await {
            eprintln!("❌ Error enviando: {}", e);
        } else {
            println!("📤 Sent to {} -> {}", remote_addr, line);
        }
    }

    Ok(())
}
