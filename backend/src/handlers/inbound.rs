use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::inbound_log::*;
use crate::models::product::Product;

#[derive(Serialize)]
pub struct InboundSingleData {
    product: Product,
    log: serde_json::Value,
}

#[derive(Serialize)]
pub struct InboundBatchData {
    products: Vec<Product>,
    count: usize,
}

#[derive(Serialize)]
pub struct UpdatedData {
    updated: bool,
}

pub async fn inbound_single(
    State(repo): State<MysqlRepository>,
    Json(req): Json<InboundSingleRequest>,
) -> JsonResult<ApiResponse<InboundSingleData>> {
    let (product, log) = repo.inbound_single(&req, "api_user").await?;
    let log_val = serde_json::to_value(&log).unwrap_or_default();
    Ok(Json(ApiResponse::ok(InboundSingleData {
        product,
        log: log_val,
    })))
}

pub async fn inbound_batch(
    State(repo): State<MysqlRepository>,
    Json(req): Json<InboundBatchRequest>,
) -> JsonResult<ApiResponse<InboundBatchData>> {
    let products = repo.inbound_batch(&req, "api_user").await?;
    let count = products.len();
    Ok(Json(ApiResponse::ok(InboundBatchData { products, count })))
}

pub async fn inbound_search_import(
    State(repo): State<MysqlRepository>,
    Json(req): Json<InboundSearchImportRequest>,
) -> JsonResult<ApiResponse<UpdatedData>> {
    repo.inbound_search_import(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(UpdatedData { updated: true })))
}

pub async fn load_inbound_logs(
    State(repo): State<MysqlRepository>,
    Json(req): Json<LoadInboundLogsRequest>,
) -> JsonResult<ApiResponse<Vec<crate::models::inbound_log::InboundLog>>> {
    let logs = repo.list_inbound_logs(&req.inventory_id).await?;
    Ok(Json(ApiResponse::ok(logs)))
}

pub async fn create_inbound_log(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateInboundLogRequest>,
) -> JsonResult<ApiResponse<serde_json::Value>> {
    let log = repo.create_inbound_log(&req, "api_user").await?;
    let val = serde_json::to_value(&log).unwrap_or_default();
    Ok(Json(ApiResponse::ok(val)))
}

pub async fn update_inbound_log(
    State(repo): State<MysqlRepository>,
    Json(req): Json<UpdateInboundLogRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    repo.update_inbound_log(&req).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

pub async fn delete_inbound_log(
    State(repo): State<MysqlRepository>,
    Json(req): Json<DeleteInboundLogRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_inbound_log(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inbound_single_data_serde() {
        let product = crate::models::product::Product {
            id: "prod_001".into(),
            inventory_id: "inv_001".into(),
            code: "A-B-0001-0010-A".into(),
            main_zone: "A".into(),
            sub_zone: "B".into(),
            seq_number: 1,
            quantity: 10,
            reserved_quantity: 0,
            status_code: "A".into(),
            name: "测试商品".into(),
            original_price: 100.0,
            market_price: 120.0,
            expected_price: 110.0,
            remark: None,
            storage_location: None,
            image_url: None,
            image_list: None,
            tags: None,
            owner_openid: "u1".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let data = InboundSingleData {
            product,
            log: serde_json::json!({"id": "log_001"}),
        };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["product"]["name"], "测试商品");
        assert_eq!(json["log"]["_id"], "log_001");
    }

    #[test]
    fn test_inbound_batch_data_serde() {
        let data = InboundBatchData {
            products: vec![],
            count: 0,
        };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["products"].as_array().unwrap().is_empty());
        assert_eq!(json["count"], 0);
    }

    #[test]
    fn test_inbound_batch_data_with_products() {
        use crate::models::product::Product;
        let product = Product {
            id: "prod_001".into(),
            inventory_id: "inv_001".into(),
            code: "A-B-0001-0010-A".into(),
            main_zone: "A".into(),
            sub_zone: "B".into(),
            seq_number: 1,
            quantity: 10,
            reserved_quantity: 0,
            status_code: "A".into(),
            name: "批量商品".into(),
            original_price: 0.0,
            market_price: 0.0,
            expected_price: 0.0,
            remark: None,
            storage_location: None,
            image_url: None,
            image_list: None,
            tags: None,
            owner_openid: "u1".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let data = InboundBatchData {
            products: vec![product],
            count: 1,
        };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["products"].as_array().unwrap().len(), 1);
        assert_eq!(json["count"], 1);
    }

    #[test]
    fn test_updated_data_serde() {
        let data = UpdatedData { updated: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["updated"].as_bool().unwrap());
    }

    #[test]
    fn test_deleted_data_serde() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_inbound_single_request_serde() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "code": "A-B-0002-0015-N",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 2,
            "quantity": 15,
            "status_code": "N",
            "name": "全新商品",
            "original_price": 200.0
        });
        let req: InboundSingleRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "全新商品");
        assert_eq!(req.original_price, Some(200.0));
        assert!(req.tags.is_none());
    }

    #[test]
    fn test_inbound_batch_request_serde() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "items": [{
                "code": "A-B-0001-0005-N",
                "main_zone": "A",
                "sub_zone": "B",
                "seq_number": 1,
                "quantity": 5,
                "status_code": "N",
                "name": "批量商品1"
            }, {
                "code": "A-B-0002-0010-N",
                "main_zone": "A",
                "sub_zone": "B",
                "seq_number": 2,
                "quantity": 10,
                "status_code": "N",
                "name": "批量商品2"
            }]
        });
        let req: InboundBatchRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.items.len(), 2);
        assert_eq!(req.items[0].name, "批量商品1");
        assert_eq!(req.items[1].name, "批量商品2");
    }

    #[test]
    fn test_load_inbound_logs_request() {
        let req = LoadInboundLogsRequest {
            inventory_id: "inv_001".into(),
        };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["inventory_id"], "inv_001");
    }
}
