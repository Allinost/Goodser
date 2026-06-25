use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Tag {
    #[serde(rename(serialize = "_id"))]
    pub id: String,
    pub name: String,
    pub color: String,
    pub owner_openid: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTagRequest {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTagRequest {
    pub id: String,
    pub name: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteTagRequest {
    pub id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tag_serialization() {
        let tag = Tag {
            id: "tag_001".into(),
            name: "热销".into(),
            color: "#ff4d4f".into(),
            owner_openid: "user_001".into(),
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&tag).unwrap();
        assert_eq!(json["name"], "热销");
        assert_eq!(json["color"], "#ff4d4f");
    }

    #[test]
    fn test_create_tag_request_default_color() {
        let json = serde_json::json!({"name": "新品"});
        let req: CreateTagRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "新品");
        assert!(req.color.is_none());
    }

    #[test]
    fn test_create_tag_request_with_color() {
        let json = serde_json::json!({"name": "清仓", "color": "#faad14"});
        let req: CreateTagRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "清仓");
        assert_eq!(req.color.as_deref(), Some("#faad14"));
    }

    #[test]
    fn test_update_tag_request_partial() {
        let json = serde_json::json!({"id": "tag_001", "color": "#52c41a"});
        let req: UpdateTagRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.id, "tag_001");
        assert!(req.name.is_none());
        assert_eq!(req.color.as_deref(), Some("#52c41a"));
    }
}
