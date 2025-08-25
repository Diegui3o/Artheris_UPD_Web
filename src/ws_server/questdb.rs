use std::sync::Arc;

use anyhow::Result;
use serde::Deserialize;
use tokio::sync::{RwLock, Mutex};
use tokio_postgres::{Client, NoTls};
use tracing::{info, warn, error, debug, trace};
use chrono::{DateTime, Utc};

#[derive(Clone)]
pub struct QuestDb {
    inner: Arc<RwLock<Client>>,
}

#[derive(Clone, Deserialize)]
pub struct QuestDbConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub database: String,
}

#[derive(Clone, Debug)]
pub struct FlightPoint {
    pub ts: DateTime<Utc>,
    pub payload: serde_json::Value,
}

impl QuestDb {
    pub async fn connect(cfg: QuestDbConfig) -> Result<Self> {
        info!("🔌 Conectando a QuestDB en {}:{}", cfg.host, cfg.port);

        let (client, connection) = match tokio_postgres::connect(
            &format!(
                "host={} port={} user={} password={} dbname={}",
                cfg.host, cfg.port, cfg.user, cfg.password, cfg.database
            ),
            NoTls,
        ).await {
            Ok(conn) => conn,
            Err(e) => {
                warn!("⚠️  No se pudo conectar a QuestDB: {}", e);
                return Err(e.into());
            }
        };

        // Inicia la conexión en segundo plano
        tokio::spawn(async move {
            if let Err(e) = connection.await {
                error!("❌ Error de conexión a QuestDB: {}", e);
            }
        });

        let db = Self {
            inner: Arc::new(RwLock::new(client)),
        };

        // Crea esquemas si no existen
        if let Err(e) = db.ensure_schema().await {
            warn!("⚠️  No se pudo inicializar esquema de QuestDB: {}", e);
        }

        info!("✅ Conexión a QuestDB establecida");
        Ok(db)
    }

    async fn ensure_schema(&self) -> Result<()> {
        // flight_logs: telemetría cruda por vuelo
        // logger_configs: auditoría de configs/eventos start/stop
        let ddl = r#"
        CREATE TABLE IF NOT EXISTS flight_logs (
            ts TIMESTAMP,
            flight_id SYMBOL,
            payload STRING
        ) TIMESTAMP(ts) PARTITION BY DAY;

        CREATE TABLE IF NOT EXISTS logger_configs (
            ts TIMESTAMP,
            config_json STRING
        ) TIMESTAMP(ts) PARTITION BY DAY;
        "#;

        let client = self.inner.read().await;
        client.batch_execute(ddl).await?;
        Ok(())
    }

    /// Inserta telemetría cruda asociada a un flight_id
    pub async fn insert_flight_log(&self, flight_id: &str, payload_json: &str) -> Result<()> {
        let client = self.inner.read().await;

        match client.execute(
            "INSERT INTO flight_logs (ts, flight_id, payload) VALUES (now(), $1, $2)",
            &[&flight_id, &payload_json],
        ).await {
            Ok(_) => {
                trace!("📊 Log de vuelo insertado: {}", flight_id);
                Ok(())
            },
            Err(e) => {
                error!("❌ Error insertando log de vuelo: {}", e);
                Err(e.into())
            }
        }
    }

    /// Guarda la configuración/eventos (start/stop) en `logger_configs`
    pub async fn insert_logger_config(&self, config_json: &str) -> Result<()> {
        let client = self.inner.read().await;

        match client.execute(
            "INSERT INTO logger_configs (ts, config_json) VALUES (now(), $1)",
            &[&config_json],
        ).await {
            Ok(_) => {
                debug!("⚙️  Configuración guardada en QuestDB");
                Ok(())
            },
            Err(e) => {
                error!("❌ Error guardando configuración: {}", e);
                Err(e.into())
            }
        }
    }

    /// Alternativa: guarda configs dentro de `flight_logs` con flight_id='__config__'
    pub async fn insert_logger_config_legacy(&self, config_json: &str) -> Result<()> {
        let q = "INSERT INTO flight_logs (ts, flight_id, payload) VALUES (now(), $1, $2)";
        let client = self.inner.read().await;
        client.execute(q, &[&"__config__", &config_json]).await?;
        Ok(())
    }

    // ---------- NUEVOS MÉTODOS QUE ESPERA mod.rs ----------

    pub async fn list_flights(&self, limit: i64) -> Result<Vec<(String, DateTime<Utc>)>> {
        let client = self.inner.read().await;
        // Tomamos el último ts por flight_id para ordenar
        let rows = client
            .query(
                "SELECT flight_id, max(ts) AS last_ts
                 FROM flight_logs
                 GROUP BY flight_id
                 ORDER BY last_ts DESC
                 LIMIT $1",
                &[&limit],
            )
            .await?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let fid: String = r.get(0);
                let ts: DateTime<Utc> = r.get(1);
                (fid, ts)
            })
            .collect())
    }

    pub async fn fetch_flight_points(
        &self,
        flight_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<FlightPoint>> {
        let client = self.inner.read().await;
    
        let rows = match (from, to) {
            (None, None) => {
                client.query(
                    "SELECT ts, payload
                     FROM flight_logs
                     WHERE flight_id=$1
                     ORDER BY ts
                     LIMIT $2",
                    &[&flight_id, &limit],
                ).await?
            }
            (Some(f), None) => {
                client.query(
                    "SELECT ts, payload
                     FROM flight_logs
                     WHERE flight_id=$1 AND ts >= $2
                     ORDER BY ts
                     LIMIT $3",
                    &[&flight_id, &f, &limit],
                ).await?
            }
            (None, Some(t)) => {
                client.query(
                    "SELECT ts, payload
                     FROM flight_logs
                     WHERE flight_id=$1 AND ts <= $2
                     ORDER BY ts
                     LIMIT $3",
                    &[&flight_id, &t, &limit],
                ).await?
            }
            (Some(f), Some(t)) => {
                client.query(
                    "SELECT ts, payload
                     FROM flight_logs
                     WHERE flight_id=$1 AND ts >= $2 AND ts <= $3
                     ORDER BY ts
                     LIMIT $4",
                    &[&flight_id, &f, &t, &limit],
                ).await?
            }
        };

        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            let ts: DateTime<Utc> = r.get(0);
            let payload_str: String = r.get(1);
            let payload = serde_json::from_str::<serde_json::Value>(&payload_str)
                .unwrap_or_else(|_| serde_json::json!({ "raw": payload_str }));
            out.push(FlightPoint { ts, payload });
        }
        Ok(out)
    }
}

/// Conexión opcional (lazy) a QuestDB
#[derive(Clone)]
pub struct OptionalDb {
    inner: Arc<Mutex<Option<QuestDb>>>,
    config: QuestDbConfig,
}

impl OptionalDb {
    /// Constructor público para usar desde main.rs
    pub fn new(config: QuestDbConfig) -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
            config,
        }
    }

    async fn ensure_connected(&self) -> Result<(), String> {
        let mut db = self.inner.lock().await;
        if db.is_none() {
            match QuestDb::connect(self.config.clone()).await {
                Ok(new_db) => { *db = Some(new_db); Ok(()) }
                Err(e) => Err(e.to_string()),
            }
        } else {
            Ok(())
        }
    }

    pub async fn insert_flight_log(&self, flight_id: &str, payload: &str) -> Result<(), String> {
        self.ensure_connected().await?;
        let db = self.inner.lock().await;
        db.as_ref()
            .unwrap()
            .insert_flight_log(flight_id, payload)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn insert_logger_config(&self, config: &str) -> Result<(), String> {
        self.ensure_connected().await?;
        let db = self.inner.lock().await;
        db.as_ref()
            .unwrap()
            .insert_logger_config(config)
            .await
            .map_err(|e| e.to_string())
    }

    // Delegados que usa mod.rs
    pub async fn list_flights(&self, limit: i64) -> Result<Vec<(String, DateTime<Utc>)>, String> {
        self.ensure_connected().await?;
        let db = self.inner.lock().await;
        db.as_ref().unwrap()
            .list_flights(limit).await
            .map_err(|e| e.to_string())
    }

    pub async fn fetch_flight_points(
        &self,
        flight_id: &str,
        from: Option<DateTime<Utc>>,
        to: Option<DateTime<Utc>>,
        limit: i64,
    ) -> Result<Vec<FlightPoint>, String> {
        self.ensure_connected().await?;
        let db = self.inner.lock().await;
        db.as_ref().unwrap()
            .fetch_flight_points(flight_id, from, to, limit)
            .await
            .map_err(|e| e.to_string())
    }
}
