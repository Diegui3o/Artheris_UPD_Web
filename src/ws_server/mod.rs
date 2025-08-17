use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio_tungstenite::accept_async;

pub async fn start_ws_server(tx: broadcast::Sender<String>) {
    let listener = TcpListener::bind("0.0.0.0:9001").await.unwrap();
    println!("🌐 WebSocket server listening on ws://0.0.0.0:9001");

    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                println!("✅ New WS client: {}", addr);
                let mut rx = tx.subscribe();

                tokio::spawn(async move {
                    let ws_stream = accept_async(stream).await.unwrap();
                    let (mut ws_sender, mut ws_receiver) = ws_stream.split();

                    // 🔹 Forward mensajes del broadcast → cliente WS
                    let mut rx_task = tokio::spawn(async move {
                        while let Ok(msg) = rx.recv().await {
                            // Serializa el mensaje como JSON con event y data
                            let json_msg = json!({
                                "event": "angles",
                                "data": serde_json::from_str::<serde_json::Value>(&msg).unwrap_or(json!({}))
                            })
                            .to_string();
                            if ws_sender
                                .send(tokio_tungstenite::tungstenite::Message::Text(json_msg))
                                .await
                                .is_err()
                            {
                                break;
                            }
                        }
                    });

                    // 🔹 Escuchar mensajes del cliente (por ahora solo imprime)
                    let mut recv_task = tokio::spawn(async move {
                        while let Some(Ok(msg)) = ws_receiver.next().await {
                            println!("💬 From WS client {} -> {}", addr, msg);
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
