use std::net::SocketAddr;
use std::sync::Arc;

use tokio::net::UdpSocket;
use tokio::sync::{broadcast, RwLock};
use tokio::io::{AsyncBufReadExt, BufReader};

use std::env;

use tracing::{info, error, warn, debug};
use tracing_subscriber::{EnvFilter, fmt};
use tracing_appender::rolling;

mod config;
mod ws_server;

use tracing_subscriber::prelude::*;

use crate::ws_server::{start_ws_server, start_http_server, WsContext};
use crate::ws_server::questdb::{QuestDb, QuestDbConfig};
use crate::ws_server::OptionalDb;

fn init_logging() -> anyhow::Result<()> {
    // Log a archivo rotativo diario en ./logs/artheris.log.YYYY-MM-DD
    let file_appender = rolling::daily("./logs", "artheris.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // Consola + archivo
    tracing_subscriber::registry()
        .with(
            fmt::layer()
                .with_writer(std::io::stdout) // consola
                .with_target(false)
                .with_level(true)
        )
        .with(
            fmt::layer()
                .with_writer(non_blocking) // archivo
                .with_target(false)
                .with_level(true)
        )
        .with(EnvFilter::from_default_env().add_directive("info".parse()?))
        .try_init()
        .map_err(|e| anyhow::anyhow!(e.to_string()))?;

    info!("🚀 Iniciando Artheris UDP/Web");
    Ok(())
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if let Err(e) = init_logging() {
        eprintln!("❌ No se pudo inicializar el logging: {e}");
        return Err(e);
    }

    // Configuración de conexión a QuestDB (opcional)
    let questdb_config = QuestDbConfig {
        host: env::var("QUESTDB_HOST").unwrap_or_else(|_| "localhost".into()),
        port: env::var("QUESTDB_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8812),
        user: env::var("QUESTDB_USER").unwrap_or_else(|_| "admin".into()),
        password: env::var("QUESTDB_PASSWORD").unwrap_or_else(|_| "quest".into()),
        database: env::var("QUESTDB_DB").unwrap_or_else(|_| "qdb".into()),
    };

    info!("🔧 Configuración de QuestDB: host={} port={}", questdb_config.host, questdb_config.port);

    let qdb = {
        let db = OptionalDb::new(questdb_config.clone());

        match QuestDb::connect(questdb_config.clone()).await {
            Ok(conn) => {
                {
                    use tokio::sync::Mutex;
                }
                info!("✅ Conectado a QuestDB");
                db
            }
            Err(e) => {
                warn!("⚠️  No se pudo conectar a QuestDB al inicio: {e}. Se intentará bajo demanda.");
                db
            }
        }
    };

    // 🔹 Estado compartido
    let current_flight_id: Arc<RwLock<Option<String>>> = Arc::new(RwLock::new(None));
    let last_config: Arc<RwLock<Option<serde_json::Value>>> = Arc::new(RwLock::new(None));

    // Canal broadcast para WS
    let (tx, _) = broadcast::channel::<String>(100);

    // --------- UDP ----------
    const LOCAL_PORT: u16 = 8889;
    const REMOTE_IP: &str = "192.168.1.50";
    const REMOTE_PORT: u16 = 8888;

    let local_addr = format!("0.0.0.0:{}", LOCAL_PORT);
    let remote_addr: SocketAddr = format!("{}:{}", REMOTE_IP, REMOTE_PORT).parse().unwrap();

    // Bind UDP local
    let socket = Arc::new(UdpSocket::bind(local_addr.clone()).await?);
    println!("✅ UDP listening on {}", local_addr);

    // 🔹 Contexto compartido
    let ws_ctx = WsContext {
        tx: tx.clone(),
        esp32_socket: Some(socket.clone()),
        remote_addr,
        questdb: qdb.clone(),                 // ahora es ws_server::server::OptionalDb
        flight_id: current_flight_id.clone(),
        last_config: last_config.clone(),
    };

    // WS server
    let ws_server = tokio::spawn({
        let ctx = ws_ctx.clone();
        async move {
            info!("🔌 Iniciando servidor WebSocket en ws://0.0.0.0:9001");
            start_ws_server(ctx).await;
            info!("✅ Servidor WebSocket detenido");
        }
    });

    {
        let socket_recv = Arc::clone(&socket);
        let tx_udp = tx.clone();
        let qdb_writer = qdb.clone();
        let flight_state = current_flight_id.clone();

        tokio::spawn(async move {
            let mut buf = vec![0u8; 4096];
            loop {
                match socket_recv.recv_from(&mut buf).await {
                    Ok((len, _src)) => {
                        if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                            let (to_ws, to_store) = match serde_json::from_str::<serde_json::Value>(text) {
                                Ok(v) => match v.get("type").and_then(|t| t.as_str()) {
                                    Some("ack") | Some("telemetry") => (v.to_string(), Some(v)),
                                    _ => {
                                        let wrapped = serde_json::json!({ "type":"telemetry", "payload": v });
                                        (wrapped.to_string(), Some(wrapped))
                                    }
                                },
                                Err(_) => {
                                    let wrapped = serde_json::json!({ "type":"telemetry", "payload": text });
                                    (wrapped.to_string(), Some(wrapped))
                                }
                            };

                            let _ = tx_udp.send(to_ws);

                            if let Some(flog) = to_store {
                                let fid_opt = { flight_state.read().await.clone() };
                                if let Some(fid) = fid_opt {
                                    if let Err(e) = qdb_writer.insert_flight_log(&fid, &flog.to_string()).await {
                                        error!("❌ Error guardando telemetría en QuestDB: {e}");
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("❌ UDP recv error: {e}");
                        break;
                    }
                }
            }
        });
    }

    // --------- Envío manual por stdin ----------
    use tokio::io::AsyncBufReadExt; // (ya importado arriba)
    let stdin = BufReader::new(tokio::io::stdin());
    let mut lines = stdin.lines();

    println!("Escribe un mensaje para enviar al ESP32 (exit para salir):");
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().eq_ignore_ascii_case("exit") {
            println!("👋 Saliendo...");
            break;
        }
        if let Err(e) = socket.send_to(line.as_bytes(), &remote_addr).await {
            error!("❌ Error enviando: {e}");
        } else {
            println!("📤 Sent to {} -> {}", remote_addr, line);
        }
    }

    // --------- Servidor HTTP ----------
    {
        let http_ctx = ws_ctx.clone();
        let _http_server = tokio::spawn(async move {
            info!("🌐 Iniciando servidor HTTP en http://0.0.0.0:3000");
            match start_http_server(http_ctx).await {
                Ok(_) => info!("✅ Servidor HTTP detenido"),
                Err(e) => error!("❌ Error en servidor HTTP: {e}"),
            }
        });
    }

    Ok(())
}