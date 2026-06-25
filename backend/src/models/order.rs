use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OrderType {
    Outbound,
    Reserve,
}

#[allow(dead_code)]
impl OrderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderType::Outbound => "outbound",
            OrderType::Reserve => "reserve",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "outbound" => Some(OrderType::Outbound),
            "reserve" => Some(OrderType::Reserve),
            _ => None,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    Pending,
    Reserved,
    Confirmed,
    Cancelled,
}

#[allow(dead_code)]
impl OrderStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            OrderStatus::Pending => "pending",
            OrderStatus::Reserved => "reserved",
            OrderStatus::Confirmed => "confirmed",
            OrderStatus::Cancelled => "cancelled",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(OrderStatus::Pending),
            "reserved" => Some(OrderStatus::Reserved),
            "confirmed" => Some(OrderStatus::Confirmed),
            "cancelled" => Some(OrderStatus::Cancelled),
            _ => None,
        }
    }

    pub fn is_active(&self) -> bool {
        matches!(self, OrderStatus::Pending | OrderStatus::Reserved)
    }

    pub fn is_terminal(&self) -> bool {
        matches!(self, OrderStatus::Confirmed | OrderStatus::Cancelled)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderItem {
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub quantity: i32,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OutboundOrder {
    #[serde(rename(serialize = "_id"))]
    pub id: String,
    pub inventory_id: String,
    pub order_no: String,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub order_type: String,
    pub status: String,
    pub order_info: Option<String>,
    pub remark: Option<String>,
    pub items: serde_json::Value,
    pub source_reserve_id: Option<String>,
    pub owner_openid: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub confirmed_at: Option<NaiveDateTime>,
    pub cancelled_at: Option<NaiveDateTime>,
}

#[derive(Debug, Deserialize)]
pub struct CreateOutboundRequest {
    pub inventory_id: String,
    pub order_no: String,
    #[serde(rename = "type")]
    pub order_type: Option<String>,
    pub status: Option<String>,
    pub order_info: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<OrderItem>,
    pub source_reserve_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfirmOutboundRequest {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CancelOutboundRequest {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CancelReserveRequest {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct ReserveToOutboundRequest {
    pub id: String,
    pub inventory_id: String,
    pub order_no: String,
    pub items: Vec<OrderItem>,
    pub order_info: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadOutboundOrdersRequest {
    pub inventory_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    mod order_type_tests {
        use super::*;

        #[test]
        fn test_order_type_as_str() {
            assert_eq!(OrderType::Outbound.as_str(), "outbound");
            assert_eq!(OrderType::Reserve.as_str(), "reserve");
        }

        #[test]
        fn test_order_type_from_str() {
            assert_eq!(OrderType::from_str("outbound"), Some(OrderType::Outbound));
            assert_eq!(OrderType::from_str("reserve"), Some(OrderType::Reserve));
            assert_eq!(OrderType::from_str("invalid"), None);
        }

        #[test]
        fn test_order_type_roundtrip() {
            for s in &["outbound", "reserve"] {
                let t = OrderType::from_str(s).unwrap();
                assert_eq!(t.as_str(), *s);
            }
        }
    }

    mod order_status_tests {
        use super::*;

        #[test]
        fn test_order_status_as_str() {
            assert_eq!(OrderStatus::Pending.as_str(), "pending");
            assert_eq!(OrderStatus::Reserved.as_str(), "reserved");
            assert_eq!(OrderStatus::Confirmed.as_str(), "confirmed");
            assert_eq!(OrderStatus::Cancelled.as_str(), "cancelled");
        }

        #[test]
        fn test_order_status_from_str() {
            assert_eq!(OrderStatus::from_str("pending"), Some(OrderStatus::Pending));
            assert_eq!(OrderStatus::from_str("reserved"), Some(OrderStatus::Reserved));
            assert_eq!(OrderStatus::from_str("confirmed"), Some(OrderStatus::Confirmed));
            assert_eq!(OrderStatus::from_str("cancelled"), Some(OrderStatus::Cancelled));
            assert_eq!(OrderStatus::from_str("unknown"), None);
        }

        #[test]
        fn test_is_active() {
            assert!(OrderStatus::Pending.is_active());
            assert!(OrderStatus::Reserved.is_active());
            assert!(!OrderStatus::Confirmed.is_active());
            assert!(!OrderStatus::Cancelled.is_active());
        }

        #[test]
        fn test_is_terminal() {
            assert!(!OrderStatus::Pending.is_terminal());
            assert!(!OrderStatus::Reserved.is_terminal());
            assert!(OrderStatus::Confirmed.is_terminal());
            assert!(OrderStatus::Cancelled.is_terminal());
        }

        #[test]
        fn test_order_status_roundtrip() {
            for s in &["pending", "reserved", "confirmed", "cancelled"] {
                let st = OrderStatus::from_str(s).unwrap();
                assert_eq!(st.as_str(), *s);
            }
        }
    }

    mod order_item_tests {
        use super::*;

        fn sample_item() -> OrderItem {
            OrderItem {
                product_id: "prod_001".into(),
                product_name: "测试商品".into(),
                product_code: "A-B-0001-0010-A".into(),
                quantity: 5,
                image_url: Some("http://example.com/img.jpg".into()),
            }
        }

        #[test]
        fn test_order_item_serde() {
            let item = sample_item();
            let json = serde_json::to_value(&item).unwrap();
            assert_eq!(json["product_name"], "测试商品");
            assert_eq!(json["quantity"], 5);
            assert_eq!(json["image_url"], "http://example.com/img.jpg");
        }

        #[test]
        fn test_order_item_deserialize() {
            let json = serde_json::json!({
                "product_id": "prod_001",
                "product_name": "Item",
                "product_code": "A-B-0001-0010-A",
                "quantity": 3
            });
            let item: OrderItem = serde_json::from_value(json).unwrap();
            assert_eq!(item.quantity, 3);
            assert!(item.image_url.is_none());
        }
    }

    mod outbound_order_tests {
        use super::*;

        fn sample_order() -> OutboundOrder {
            OutboundOrder {
                id: "ord_001".into(),
                inventory_id: "inv_001".into(),
                order_no: "OUT20260608001".into(),
                order_type: "outbound".into(),
                status: "pending".into(),
                order_info: Some("订单信息".into()),
                remark: Some("备注".into()),
                items: serde_json::json!([{
                    "product_id": "prod_001",
                    "product_name": "Item",
                    "product_code": "A-B-0001-0010-A",
                    "quantity": 5
                }]),
                source_reserve_id: None,
                owner_openid: "user_001".into(),
                created_at: NaiveDateTime::parse_from_str("2026-06-08 10:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
                updated_at: NaiveDateTime::parse_from_str("2026-06-08 10:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
                confirmed_at: None,
                cancelled_at: None,
            }
        }

        #[test]
        fn test_outbound_order_serialization() {
            let order = sample_order();
            let json = serde_json::to_value(&order).unwrap();
            assert_eq!(json["order_no"], "OUT20260608001");
            assert_eq!(json["type"], "outbound");
            assert_eq!(json["status"], "pending");
        }

        #[test]
        fn test_create_outbound_request_serde() {
            let json = serde_json::json!({
                "inventory_id": "inv_001",
                "order_no": "OUT20260608001",
                "items": [{
                    "product_id": "prod_001",
                    "product_name": "Item",
                    "product_code": "A-B-0001-0010-A",
                    "quantity": 5
                }]
            });
            let req: CreateOutboundRequest = serde_json::from_value(json).unwrap();
            assert_eq!(req.order_no, "OUT20260608001");
            assert_eq!(req.items.len(), 1);
            assert!(req.order_type.is_none());
        }
    }
}
