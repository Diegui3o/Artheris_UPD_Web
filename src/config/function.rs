use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

#[derive(Debug)]
pub struct Modo {
    pub value: String,
}

/// Actualiza el modo y lo emite por WebSocket y UDP al ESP32
pub async fn update_mode(
    new_mode: &str,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    modo_ref: &mut Modo,
    ws_tx: &broadcast::Sender<String>,
) {
    if modo_ref.value != new_mode {
        modo_ref.value = new_mode.to_string();

        // Emitir al WebSocket
        let _ = ws_tx.send(format!(r#"{{"type":"modo","value":"{}"}}"#, modo_ref.value));

        // Enviar comando al ESP32
        if let Some(socket) = esp32_socket {
            let mode_command = format!(r#"{{"type":"command","payload":{{"mode":"{}"}}}}"#, new_mode);
            if let Err(e) = socket.send_to(mode_command.as_bytes(), remote_addr).await {
                eprintln!("❌ Error enviando modo al ESP32: {}", e);
            } else {
                println!("📤 Enviado comando de modo al ESP32: {}", mode_command);
            }
        }

        println!("📢 Modo cambiado a: {}", modo_ref.value);
    }
}

/// Enciende o apaga el LED en todos los ESP32 y notifica al WebSocket
pub async fn set_led_state(
    led_on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
) {
    let command = format!(r#"{{"type":"command","payload":{{"led":{}}}}}"#, led_on);

    // UDP al ESP32
    if let Some(socket) = esp32_socket {
        if let Err(e) = socket.send_to(command.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando LED al ESP32: {}", e);
        }
    }

    // Notificar WebSocket
    let _ = ws_tx.send(format!(r#"{{"type":"led","value":{}}}"#, led_on));

    println!("📤 Enviando comando de LED al ESP32: {}", if led_on { "ON" } else { "OFF" });
}

/// Enciende o apaga los motores en todos los ESP32 y notifica al WebSocket
pub async fn set_motors_state(
    motors_on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
) {
    let command = format!(r#"{{"type":"command","payload":{{"motors":{}}}}}"#, motors_on);

    // UDP al ESP32
    if let Some(socket) = esp32_socket {
        if let Err(e) = socket.send_to(command.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando motores al ESP32: {}", e);
        }
    }

    // Notificar WebSocket
    let _ = ws_tx.send(format!(r#"{{"type":"motors","value":{}}}"#, motors_on));

    println!("📤 Enviando comando de MOTORES al ESP32: {}", if motors_on { "ON" } else { "OFF" });
}

/// Cambia el modo en todos los ESP32 y notifica al WebSocket
pub async fn set_mode(
    mode: &str,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
) {
    let command = format!(r#"{{"type":"command","payload":{{"mode":"{}"}}}}"#, mode);

    // UDP al ESP32
    if let Some(socket) = esp32_socket {
        if let Err(e) = socket.send_to(command.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando modo al ESP32: {}", e);
        }
    }

    // Notificar WebSocket
    let _ = ws_tx.send(format!(r#"{{"type":"modo","value":"{}"}}"#, mode));

    println!("📤 Enviando comando de MODO al ESP32: {}", mode);
}
