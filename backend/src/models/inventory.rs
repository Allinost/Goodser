use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Inventory {
    #[serde(rename(serialize = "_id"))]
    pub id: String,
    pub name: String,
    pub owner_openid: String,
    pub sort_order: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateInventoryRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInventoryRequest {
    pub id: String,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteInventoryRequest {
    pub id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_inventory_request_serde() {
        let json = serde_json::json!({"name": "测试仓库"});
        let req: CreateInventoryRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "测试仓库");
    }

    #[test]
    fn test_update_inventory_request_partial() {
        let json = serde_json::json!({"id": "inv_001", "name": null});
        let req: UpdateInventoryRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.id, "inv_001");
        assert!(req.name.is_none());
    }

    #[test]
    fn test_delete_inventory_request() {
        let json = serde_json::json!({"id": "inv_001"});
        let req: DeleteInventoryRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.id, "inv_001");
    }

    #[test]
    fn test_inventory_serialization() {
        let inv = Inventory {
            id: "inv_001".into(),
            name: "默认仓库".into(),
            owner_openid: "user_001".into(),
            sort_order: 0,
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&inv).unwrap();
        assert_eq!(json["name"], "默认仓库");
        assert_eq!(json["sort_order"], 0);
    }
}
