use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiResponse, JsonResult};
use crate::models::order::*;

#[derive(Serialize)]
pub struct OrderData {
    #[serde(flatten)]
    order: OutboundOrder,
}

#[derive(Serialize)]
pub struct CancelledData {
    cancelled: bool,
}

#[derive(Serialize)]
pub struct ConfirmedData {
    confirmed: bool,
}

pub async fn load_outbound_orders(
    State(repo): State<MysqlRepository>,
    Json(req): Json<LoadOutboundOrdersRequest>,
) -> JsonResult<ApiResponse<Vec<OutboundOrder>>> {
    let orders = repo.list_outbound_orders(&req.inventory_id).await?;
    Ok(Json(ApiResponse::ok(orders)))
}

pub async fn create_outbound(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateOutboundRequest>,
) -> JsonResult<ApiResponse<OrderData>> {
    let order = repo.create_outbound_order(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(OrderData { order })))
}

pub async fn confirm_outbound(
    State(repo): State<MysqlRepository>,
    Json(req): Json<ConfirmOutboundRequest>,
) -> JsonResult<ApiResponse<ConfirmedData>> {
    repo.confirm_outbound(&req.id).await?;
    Ok(Json(ApiResponse::ok(ConfirmedData { confirmed: true })))
}

pub async fn cancel_outbound(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CancelOutboundRequest>,
) -> JsonResult<ApiResponse<CancelledData>> {
    repo.cancel_outbound(&req.id).await?;
    Ok(Json(ApiResponse::ok(CancelledData { cancelled: true })))
}

pub async fn cancel_reserve(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CancelReserveRequest>,
) -> JsonResult<ApiResponse<CancelledData>> {
    repo.cancel_reserve(&req.id).await?;
    Ok(Json(ApiResponse::ok(CancelledData { cancelled: true })))
}

pub async fn reserve_to_outbound(
    State(repo): State<MysqlRepository>,
    Json(req): Json<ReserveToOutboundRequest>,
) -> JsonResult<ApiResponse<OrderData>> {
    let order = repo.reserve_to_outbound(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(OrderData { order })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_order() -> OutboundOrder {
        OutboundOrder {
            id: "ord_001".into(),
            inventory_id: "inv_001".into(),
            order_no: "OUT20260608001".into(),
            order_type: "outbound".into(),
            status: "pending".into(),
            order_info: None,
            remark: None,
            items: serde_json::json!([{
                "product_id": "prod_001",
                "product_name": "Test",
                "product_code": "A-B-0001-0010-A",
                "quantity": 5
            }]),
            source_reserve_id: None,
            owner_openid: "user_001".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-06-08 10:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-06-08 10:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            confirmed_at: None,
            cancelled_at: None,
        }
    }

    #[test]
    fn test_order_data_serde() {
        let data = OrderData { order: sample_order() };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["order_no"], "OUT20260608001");
        assert_eq!(json["status"], "pending");
    }

    #[test]
    fn test_confirmed_data_serde() {
        let data = ConfirmedData { confirmed: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["confirmed"].as_bool().unwrap());
    }

    #[test]
    fn test_cancelled_data_serde() {
        let data = CancelledData { cancelled: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["cancelled"].as_bool().unwrap());
    }

    #[test]
    fn test_order_data_with_reserve_type() {
        let order = OutboundOrder {
            order_type: "reserve".into(),
            status: "reserved".into(),
            ..sample_order()
        };
        let data = OrderData { order };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["type"], "reserve");
        assert_eq!(json["status"], "reserved");
    }

    #[test]
    fn test_order_data_with_dates() {
        let order = OutboundOrder {
            confirmed_at: Some(chrono::NaiveDateTime::parse_from_str("2026-06-08 12:00:00", "%Y-%m-%d %H:%M:%S").unwrap()),
            cancelled_at: None,
            ..sample_order()
        };
        let data = OrderData { order };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["confirmed_at"].is_string());
        assert!(json["cancelled_at"].is_null());
    }

    #[test]
    fn test_create_outbound_request_with_type() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "order_no": "RSV20260608001",
            "type": "reserve",
            "items": [{
                "product_id": "prod_001",
                "product_name": "Item",
                "product_code": "A-B-0001-0010-A",
                "quantity": 3
            }]
        });
        let req: CreateOutboundRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.order_type.as_deref(), Some("reserve"));
    }

    #[test]
    fn test_confirm_cancel_requests() {
        let req = ConfirmOutboundRequest { id: "ord_001".into() };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["id"], "ord_001");

        let req = CancelOutboundRequest { id: "ord_002".into() };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["id"], "ord_002");

        let req = CancelReserveRequest { id: "ord_003".into() };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["id"], "ord_003");
    }

    #[test]
    fn test_reserve_to_outbound_request_serde() {
        let json = serde_json::json!({
            "id": "ord_001",
            "inventory_id": "inv_001",
            "order_no": "OUT20260608002",
            "items": [{
                "product_id": "prod_001",
                "product_name": "Item",
                "product_code": "A-B-0001-0010-A",
                "quantity": 5
            }]
        });
        let req: ReserveToOutboundRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.id, "ord_001");
        assert_eq!(req.items.len(), 1);
    }
}
