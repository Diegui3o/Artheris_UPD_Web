use std::collections::BTreeMap;
use serde_json::{Map, Value};
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tracing::info;

#[derive(Debug)]
pub struct IlpTcp {
    pub addr: String,
    pub table: String,
}

impl IlpTcp {
    pub fn new(addr: String, table: &str) -> Self {
        Self { addr, table: table.to_string() }
    }

    pub fn json_to_line(
        &self,
        tags: &BTreeMap<String, String>,
        fields: &Map<String, Value>,
        ts_ns: Option<i64>,
    ) -> Option<String> {
        let mut head = self.table.clone();
        if !tags.is_empty() {
            let joined = tags
                .iter()
                .filter(|(_, v)| !v.is_empty())
                .map(|(k, v)| format!("{}={}", 
                    k.replace(',', "\\,").replace(' ', "\\ ").replace('=', "\\="),
                    v.replace(',', "\\,").replace(' ', "\\ ").replace('=', "\\=")))
                .collect::<Vec<_>>()
                .join(",");
            head.push(',');
            head.push_str(&joined);
        }

        let mut field_pairs = Vec::new();
        for (k, v) in fields {
            match v {
                Value::Null => {}
                Value::Bool(b) => field_pairs.push(format!("{}={}", k, if *b { "t" } else { "f" })),
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        field_pairs.push(format!("{}={}i", k, i));
                    } else if let Some(f) = n.as_f64() {
                        if f.is_finite() {
                            field_pairs.push(format!("{}={}", k, f));
                        }
                    }
                }
                Value::String(s) => field_pairs.push(format!("{}=\"{}\"", k, s.replace('"', "\\\""))),
                _ => field_pairs.push(format!("{}=\"{}\"", k, v.to_string().replace('"', "\\\""))),
            }
        }

        if field_pairs.is_empty() { return None; }

        let mut line = format!("{} {}", head, field_pairs.join(","));
        if let Some(ns) = ts_ns { line.push(' '); line.push_str(&ns.to_string()); }
        Some(line)
    }

    pub async fn write_lines(&self, lines: &[String]) -> anyhow::Result<()> {
        if lines.is_empty() { return Ok(()); }
        
        let body = lines.join("\n") + "\n";
        
        match TcpStream::connect(&self.addr).await {
            Ok(mut stream) => {
                stream.write_all(body.as_bytes()).await?;
                // Sin shutdown - se cierra al salir
                info!("✅ ILP TCP: {} líneas", lines.len());
                Ok(())
            }
            Err(e) => {
                anyhow::bail!("ILP TCP failed: {}", e);
            }
        }
    }
}

pub fn choose_timestamp_ns(iso_or_none: Option<&str>) -> i64 {
    use chrono::{DateTime, Utc};
    match iso_or_none {
        Some(s) => {
            let dt = DateTime::parse_from_rfc3339(s)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());
            dt.timestamp_nanos_opt().unwrap_or_else(|| dt.timestamp_micros() * 1000)
        }
        None => {
            let now = Utc::now();
            now.timestamp_nanos_opt().unwrap_or_else(|| now.timestamp_micros() * 1000)
        }
    }
}