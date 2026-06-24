use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiResponse, JsonResult};

#[derive(Serialize)]
pub struct HealthStatus {
    pub status: String,
    pub database: String,
    pub version: String,
    pub uptime_secs: u64,
}

static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

fn get_start_time() -> std::time::Instant {
    *START_TIME.get_or_init(std::time::Instant::now)
}

pub async fn health_check(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<HealthStatus>> {
    let db_status = match sqlx::query("SELECT 1")
        .execute(repo.pool())
        .await
    {
        Ok(_) => "connected".to_string(),
        Err(e) => format!("error: {e}"),
    };

    let uptime = get_start_time().elapsed().as_secs();

    Ok(Json(ApiResponse::ok(HealthStatus {
        status: "ok".into(),
        database: db_status,
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: uptime,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_status_serde() {
        let h = HealthStatus {
            status: "ok".into(),
            database: "connected".into(),
            version: "0.1.0".into(),
            uptime_secs: 12345,
        };
        let json = serde_json::to_value(&h).unwrap();
        assert_eq!(json["status"], "ok");
        assert_eq!(json["database"], "connected");
        assert_eq!(json["version"], "0.1.0");
        assert_eq!(json["uptime_secs"], 12345);
    }

    #[test]
    fn test_health_status_error_db() {
        let h = HealthStatus {
            status: "ok".into(),
            database: "error: connection refused".into(),
            version: "0.1.0".into(),
            uptime_secs: 0,
        };
        let json = serde_json::to_value(&h).unwrap();
        assert!(json["database"].as_str().unwrap().contains("error"));
    }
}
