use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

pub async fn set_motor_one_speed(
    id: u32,
    us: u32,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
) {
    let payload = json!({
        "type":"command",
        "payload": { "motor": { "id": id, "speed": us } }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando MOTOR ONE SPEED: {e}");
            ok = false;
        }
    } else { ok = false; }

    if let Some(rid) = request_id {
        let _ = ws_tx.send(json!({
            "type":"ack", "request_id": rid, "ok": ok
        }).to_string());
    }
    let _ = ws_tx.send(json!({
        "type":"motor","target":"one","id": id,"speed": us
    }).to_string());
}

pub async fn set_motors_many_speed(
    ids: &[u32],
    us: u32,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
) {
    let payload = json!({
        "type":"command",
        "payload": { "motors": { "ids": ids, "speed": us } }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando MOTORS MANY SPEED: {e}");
            ok = false;
        }
    } else { ok = false; }

    if let Some(rid) = request_id {
        let _ = ws_tx.send(json!({
            "type":"ack", "request_id": rid, "ok": ok
        }).to_string());
    }
    if ok {
        for &id in ids {
            let _ = ws_tx.send(json!({
                "type":"motor","target":"one","id": id,"speed": us
            }).to_string());
        }
    }
}

pub async fn set_motors_all_speed(
    us: u32,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
) {
    let payload = json!({
        "type":"command",
        "payload": { "motors": { "speed": us } }
    });
    let txt = payload.to_string();

    let mut ok = true;
    if let Some(sock) = esp32_socket {
        if let Err(e) = sock.send_to(txt.as_bytes(), remote_addr).await {
            eprintln!("❌ Error enviando MOTORS ALL SPEED: {e}");
            ok = false;
        }
    } else { ok = false; }

    if let Some(rid) = request_id {
        let _ = ws_tx.send(json!({
            "type":"ack", "request_id": rid, "ok": ok
        }).to_string());
    }
    let _ = ws_tx.send(json!({
        "type":"motors","target":"all","speed": us
    }).to_string());
}


pub async fn set_led_all(
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
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
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }
    let _ = ws_tx.send(json!({"type":"led","target":"all","value": on}).to_string());
}

/// Un LED específico
pub async fn set_led_one(
    id: u32,
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
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
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }
    let _ = ws_tx.send(json!({"type":"led","target":"one","id": id,"value": on}).to_string());
}

/// Varios LEDs a la vez
pub async fn set_led_many(
    ids: &[u32],
    on: bool,
    esp32_socket: Option<Arc<UdpSocket>>,
    remote_addr: SocketAddr,
    ws_tx: &broadcast::Sender<String>,
    request_id: Option<&str>,
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
    if let Some(rid) = request_id {
        let ack = if ok {
            json!({"type":"ack","request_id": rid, "ok": true})
        } else {
            json!({"type":"ack","request_id": rid, "ok": false, "info":"udp_send_failed_or_missing_socket"})
        };
        let _ = ws_tx.send(ack.to_string());
    }
    if ok {
        for &id in ids {
            let _ = ws_tx.send(json!({"type":"led","target":"one","id": id,"value": on}).to_string());
        }
    }
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
