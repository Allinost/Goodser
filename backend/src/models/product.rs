use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    #[serde(rename(serialize = "_id"))]
    pub id: String,
    pub inventory_id: String,
    pub code: String,
    pub main_zone: String,
    pub sub_zone: String,
    pub seq_number: i32,
    pub quantity: i32,
    pub reserved_quantity: i32,
    pub status_code: String,
    pub name: String,
    pub original_price: f64,
    pub market_price: f64,
    pub expected_price: f64,
    pub remark: Option<String>,
    pub storage_location: Option<String>,
    pub image_url: Option<String>,
    pub image_list: Option<serde_json::Value>,
    pub tags: Option<serde_json::Value>,
    pub owner_openid: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub inventory_id: String,
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
pub struct UpdateProductRequest {
    pub id: String,
    pub inventory_id: Option<String>,
    pub code: Option<String>,
    pub main_zone: Option<String>,
    pub sub_zone: Option<String>,
    pub seq_number: Option<i32>,
    pub quantity: Option<i32>,
    pub status_code: Option<String>,
    pub name: Option<String>,
    pub original_price: Option<f64>,
    pub market_price: Option<f64>,
    pub expected_price: Option<f64>,
    pub remark: Option<String>,
    pub storage_location: Option<String>,
    pub image_url: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DeleteProductRequest {
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AllocateSeqRequest {
    pub inventory_id: String,
    pub main_zone: String,
    pub sub_zone: String,
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
pub struct AllocateSeqResponse {
    pub seq_number: i32,
}

#[derive(Debug, Deserialize)]
pub struct LoadProductsRequest {
    pub inventory_id: String,
}

#[cfg(test)]
pub(crate) fn make_product() -> Product {
    Product {
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
        remark: Some("备注".into()),
        storage_location: Some("A区-1架".into()),
        image_url: Some("http://example.com/img.jpg".into()),
        image_list: None,
        tags: Some(serde_json::json!(["tag_1", "tag_2"])),
        owner_openid: "user_001".into(),
        created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        updated_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_product_serde_roundtrip() {
        let p = make_product();
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["name"], "测试商品");
        assert_eq!(json["code"], "A-B-0001-0010-A");
        assert_eq!(json["quantity"], 10);
        assert_eq!(json["reserved_quantity"], 0);
        assert_eq!(json["original_price"], 100.0);
    }

    #[test]
    fn test_create_product_request_defaults() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "code": "A-B-0001-0005-A",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 1,
            "status_code": "A",
            "name": "New Product"
        });
        let req: CreateProductRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "New Product");
        assert!(req.quantity.is_none());
        assert!(req.original_price.is_none());
        assert!(req.tags.is_none());
    }

    #[test]
    fn test_update_product_request_partial() {
        let json = serde_json::json!({
            "id": "prod_001",
            "name": "Updated Name",
            "quantity": 20
        });
        let req: UpdateProductRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name.as_deref(), Some("Updated Name"));
        assert_eq!(req.quantity, Some(20));
        assert!(req.main_zone.is_none());
    }

    #[test]
    fn test_allocate_seq_request() {
        let req = AllocateSeqRequest {
            inventory_id: "inv_001".into(),
            main_zone: "A".into(),
            sub_zone: "B".into(),
        };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["main_zone"], "A");
        assert_eq!(json["sub_zone"], "B");
    }

    #[test]
    fn test_product_with_all_fields() {
        let p = make_product();
        assert_eq!(p.tags.as_ref().and_then(|t| t.as_array()).map(|a| a.len()), Some(2));
        assert_eq!(p.storage_location.as_deref(), Some("A区-1架"));
        assert_eq!(p.expected_price, 110.0);
    }

    #[test]
    fn test_product_with_tags() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "code": "A-B-0001-0010-A",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 1,
            "quantity": 10,
            "status_code": "A",
            "name": "Test",
            "tags": ["tag_a", "tag_b"]
        });
        let req: CreateProductRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.tags.as_ref().unwrap().len(), 2);
    }
}
