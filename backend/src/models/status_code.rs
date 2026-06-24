use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StatusCode {
    pub id: String,
    pub code: String,
    pub label: String,
    pub is_system: bool,
    pub owner_openid: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddStatusCodeRequest {
    pub code: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusCodeRequest {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Deserialize)]
pub struct RemoveStatusCodeRequest {
    pub id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_status_code_serialization() {
        let sc = StatusCode {
            id: "sc_a".into(),
            code: "A".into(),
            label: "正常".into(),
            is_system: true,
            owner_openid: "system".into(),
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&sc).unwrap();
        assert_eq!(json["code"], "A");
        assert_eq!(json["label"], "正常");
        assert!(json["is_system"].as_bool().unwrap());
    }

    #[test]
    fn test_add_status_code_request() {
        let req = AddStatusCodeRequest {
            code: "G".into(),
            label: "自定义".into(),
        };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["code"], "G");
        assert_eq!(json["label"], "自定义");
    }

    #[test]
    fn test_status_code_is_system_flag() {
        let sc = StatusCode {
            id: "sc_g".into(),
            code: "G".into(),
            label: "自定义".into(),
            is_system: false,
            owner_openid: "user_001".into(),
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        assert!(!sc.is_system);
    }
}
