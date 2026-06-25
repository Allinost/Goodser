use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::db::mysql::InventoryStats;
use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::inventory::*;

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
) -> JsonResult<ApiResponse<Inventory>> {
    let inv = repo.create_inventory(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(inv)))
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

pub async fn list_inventories_rest(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<Inventory>>> {
    load_inventories(repo).await
}

pub async fn create_inventory_rest(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateInventoryRequest>,
) -> JsonResult<ApiResponse<Inventory>> {
    create_inventory(repo, Json(req)).await
}

pub async fn update_inventory_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
    Json(req): Json<UpdateInventoryRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    repo.update_inventory(&UpdateInventoryRequest { id, name: req.name }).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_inventory_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_inventory(&id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn inventory_stats(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
) -> JsonResult<ApiResponse<InventoryStats>> {
    let stats = repo.get_inventory_stats(&id).await?;
    Ok(Json(ApiResponse::ok(stats)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_inventory() -> Inventory {
        Inventory {
            id: "inv_001".into(),
            name: "默认仓库".into(),
            owner_openid: "user_001".into(),
            sort_order: 0,
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        }
    }

    #[test]
    fn test_inventory_serializes_with_underscore_id() {
        let inv = sample_inventory();
        let json = serde_json::to_value(&inv).unwrap();
        assert_eq!(json["_id"], "inv_001");
        assert_eq!(json["name"], "默认仓库");
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
    fn test_inventory_in_api_response() {
        let inv = sample_inventory();
        let resp = ApiResponse::ok(inv);
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["_id"], "inv_001");
        assert_eq!(json["data"]["name"], "默认仓库");
    }

    #[test]
    fn test_create_inventory_request_serde() {
        let json = serde_json::json!({"name": "新仓库"});
        let req: CreateInventoryRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "新仓库");
    }
}
