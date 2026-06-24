use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundLogItem {
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub quantity: i32,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InboundLog {
    pub id: String,
    pub inventory_id: String,
    pub order_no: Option<String>,
    #[serde(rename = "type")]
    pub log_type: String,
    pub remark: Option<String>,
    pub items: serde_json::Value,
    pub owner_openid: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateInboundLogRequest {
    pub inventory_id: String,
    pub order_no: Option<String>,
    #[serde(rename = "type")]
    pub log_type: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<InboundLogItem>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateInboundLogRequest {
    pub id: String,
    pub remark: Option<String>,
    pub items: Option<Vec<InboundLogItem>>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteInboundLogRequest {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct InboundSingleRequest {
    pub inventory_id: String,
    pub order_no: Option<String>,
    pub code: String,
    pub main_zone: String,
    pub sub_zone: String,
    pub seq_number: i32,
    pub quantity: Option<i32>,
    pub status_code: String,
    pub name: String,
    pub original_price: Option<f64>,
    pub market_price: Option<f64>,
    pub expected_price: Option<f64>,
    pub remark: Option<String>,
    pub storage_location: Option<String>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct InboundBatchRequest {
    pub inventory_id: String,
    pub order_no: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<InboundBatchItem>,
}

#[derive(Debug, Deserialize)]
pub struct InboundBatchItem {
    pub code: String,
    pub main_zone: String,
    pub sub_zone: String,
    pub seq_number: i32,
    pub quantity: Option<i32>,
    pub status_code: String,
    pub name: String,
    pub original_price: Option<f64>,
    pub market_price: Option<f64>,
    pub expected_price: Option<f64>,
    pub remark: Option<String>,
    pub storage_location: Option<String>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct InboundSearchImportRequest {
    pub inventory_id: String,
    pub order_no: Option<String>,
    pub remark: Option<String>,
    pub items: Vec<SearchImportItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchImportItem {
    pub product_id: String,
    pub product_name: String,
    pub product_code: String,
    pub quantity: i32,
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoadInboundLogsRequest {
    pub inventory_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inbound_log_item_serde() {
        let item = InboundLogItem {
            product_id: "prod_001".into(),
            product_name: "测试商品".into(),
            product_code: "A-B-0001-0010-A".into(),
            quantity: 10,
            image_url: Some("http://example.com/img.jpg".into()),
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json["product_name"], "测试商品");
        assert_eq!(json["quantity"], 10);
        assert!(json["image_url"].is_string());
    }

    #[test]
    fn test_inbound_log_item_no_image() {
        let item = InboundLogItem {
            product_id: "prod_002".into(),
            product_name: "无图商品".into(),
            product_code: "C-D-0001-0005-B".into(),
            quantity: 5,
            image_url: None,
        };
        let json = serde_json::to_value(&item).unwrap();
        assert!(json["image_url"].is_null());
    }

    #[test]
    fn test_inbound_log_serialization() {
        let log = InboundLog {
            id: "log_001".into(),
            inventory_id: "inv_001".into(),
            order_no: Some("IN20260608001".into()),
            log_type: "single".into(),
            remark: Some("测试入库".into()),
            items: serde_json::json!([{
                "product_id": "prod_001",
                "product_name": "Item",
                "product_code": "A-B-0001-0010-A",
                "quantity": 10
            }]),
            owner_openid: "user_001".into(),
            created_at: NaiveDateTime::parse_from_str("2026-06-08 10:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&log).unwrap();
        assert_eq!(json["type"], "single");
        assert_eq!(json["order_no"], "IN20260608001");
    }

    #[test]
    fn test_inbound_batch_item_serde() {
        let json = serde_json::json!({
            "code": "A-B-0001-0010-A",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 1,
            "quantity": 10,
            "status_code": "A",
            "name": "批量商品"
        });
        let item: InboundBatchItem = serde_json::from_value(json).unwrap();
        assert_eq!(item.name, "批量商品");
        assert!(item.original_price.is_none());
    }

    #[test]
    fn test_search_import_item() {
        let item = SearchImportItem {
            product_id: "prod_001".into(),
            product_name: "搜索导入".into(),
            product_code: "A-B-0001-0010-A".into(),
            quantity: 5,
            image_url: None,
        };
        let json = serde_json::to_value(&item).unwrap();
        assert_eq!(json["quantity"], 5);
    }

    #[test]
    fn test_inbound_single_request_full() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "code": "A-B-0002-0015-A",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 2,
            "quantity": 15,
            "status_code": "A",
            "name": "单独入库商品",
            "original_price": 50.0,
            "market_price": 60.0,
            "expected_price": 55.0,
            "tags": ["tag_a"]
        });
        let req: InboundSingleRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "单独入库商品");
        assert_eq!(req.seq_number, 2);
        assert_eq!(req.tags.as_ref().unwrap().len(), 1);
        assert_eq!(req.original_price, Some(50.0));
    }
}
