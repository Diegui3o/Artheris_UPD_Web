use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

pub async fn set_led_all(
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>, // 👈 nuevo
) {
    let payload = json!({
        "type": "command",
        "payload": { "led": on }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando LED ALL al ESP32: {}", e);
            ok = false;
        }
    } else {
        ok = false;
    }

    // ACK (si venía request_id)
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }

    // Notificación WS (todos)
    let _ = ws_tx.send(json!({"type":"led","target":"all","value": on}).to_string());
}

/// Un LED específico
pub async fn set_led_one(
    id: u32,
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>, // 👈 nuevo
) {
    let payload = json!({
        "type": "command",
        "payload": { "led": { "id": id, "state": on } }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando LED ONE al ESP32: {}", e);
            ok = false;
        }
    } else {
        ok = false;
    }

    // ACK (si venía request_id)
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }

    // Notificación WS (uno)
    let _ = ws_tx.send(json!({"type":"led","target":"one","id": id,"value": on}).to_string());
}

/// Varios LEDs a la vez
pub async fn set_led_many(
    ids: &[u32],
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>, // 👈 nuevo
) {
    let payload = json!({
        "type": "command",
        "payload": { "leds": { "ids": ids, "state": on } }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando LED MANY al ESP32: {}", e);
            ok = false;
        }
    } else {
        ok = false;
    }

    // ACK (si venía request_id)
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }

    // 🔄 Para que el front se sincronice sin soportar "many", emite uno por id
    if ok {
        for &id in ids {
            let _ = ws_tx.send(json!({"type":"led","target":"one","id": id,"value": on}).to_string());
        }
    }
    // (Si prefieres mantener también un evento "many", puedes enviarlo además)
}

/// Enciende o apaga los motores y notifica
pub async fn set_motors_state(
    motors_on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>, // 👈 nuevo
) {
    let command = format!(r#"{{"type":"command","payload":{{"motors":{}}}}}"#, motors_on);

    let mut ok = true;
    if let Some(socket) = esp32_socket {
        if let Err(e) = socket.send_to(command.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando motores al ESP32: {}", e);
            ok = false;
        }
    } else {
        ok = false;
    }

    // ACK
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }

    // Evento de estado (broadcast)
    let _ = ws_tx.send(json!({"type":"motors","value": motors_on}).to_string());

    println!("📤 Enviando comando de MOTORES al ESP32: {}", if motors_on { "ON" } else { "OFF" });
}

/// Cambia el modo y notifica
pub async fn set_mode(
    mode: &str,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>, // 👈 nuevo
) {
    let command = format!(r#"{{"type":"command","payload":{{"mode":"{}"}}}}"#, mode);

    let mut ok = true;
    if let Some(socket) = esp32_socket {
        if let Err(e) = socket.send_to(command.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando modo al ESP32: {}", e);
            ok = false;
        }
    } else {
        ok = false;
    }

    // ACK
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }

    // Evento de estado (broadcast)
    let _ = ws_tx.send(json!({"type":"modo","value": mode}).to_string());

    println!("📤 Enviando comando de MODO al ESP32: {}", mode);
}
