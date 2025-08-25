use crate::ws_server::WsContext;
use tracing::info;

pub async fn start_http_server(_ctx: WsContext) -> anyhow::Result<()> {
    info!("(stub) Servidor HTTP iniciado");
    Ok(())
}