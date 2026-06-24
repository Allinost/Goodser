use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::inventory::*;

#[derive(Serialize)]
pub struct InventoryData {
    inventory: Inventory,
}

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

pub async fn load_inventories(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<Inventory>>> {
    let items = repo.list_inventories().await?;
    Ok(Json(ApiResponse::ok(items)))
}

pub async fn create_inventory(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateInventoryRequest>,
) -> JsonResult<ApiResponse<InventoryData>> {
    let inv = repo.create_inventory(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(InventoryData { inventory: inv })))
}

pub async fn update_inventory(
    State(repo): State<MysqlRepository>,
    Json(req): Json<UpdateInventoryRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    repo.update_inventory(&req).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_inventory(
    State(repo): State<MysqlRepository>,
    Json(req): Json<DeleteInventoryRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_inventory(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inventory_data_serialization() {
        let inv = Inventory {
            id: "inv_001".into(),
            name: "默认仓库".into(),
            owner_openid: "user_001".into(),
            sort_order: 0,
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let data = InventoryData { inventory: inv };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["inventory"]["name"], "默认仓库");
        assert_eq!(json["inventory"]["sort_order"], 0);
    }

    #[test]
    fn test_deleted_data_serialization() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());

        let data = DeletedData { deleted: false };
        let json = serde_json::to_value(&data).unwrap();
        assert!(!json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_inventory_data_in_api_response() {
        let inv = Inventory {
            id: "inv_001".into(),
            name: "测试".into(),
            owner_openid: "u1".into(),
            sort_order: 1,
            created_at: chrono::NaiveDateTime::parse_from_str("2026-06-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-06-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let resp = ApiResponse::ok(InventoryData { inventory: inv });
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["inventory"]["name"], "测试");
    }

    #[test]
    fn test_create_inventory_request_serde() {
        let json = serde_json::json!({"name": "新仓库"});
        let req: CreateInventoryRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "新仓库");
    }
}
