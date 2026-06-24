pub mod inbound_log;
pub mod inventory;
pub mod order;
pub mod product;
pub mod status_code;
pub mod tag;
pub mod whitelist;

use serde::Serialize;

#[allow(dead_code)]
#[derive(Serialize)]
pub struct ApiListResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
}

#[allow(dead_code)]
impl<T: Serialize> ApiListResponse<T> {
    pub fn new(items: Vec<T>, total: i64) -> Self {
        Self { items, total }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Serialize, PartialEq, Debug)]
    struct TestItem {
        id: i32,
        name: String,
    }

    #[test]
    fn test_api_list_response_new() {
        let items = vec![
            TestItem { id: 1, name: "a".into() },
            TestItem { id: 2, name: "b".into() },
        ];
        let resp = ApiListResponse::new(items, 10);
        assert_eq!(resp.total, 10);
        assert_eq!(resp.items.len(), 2);
    }

    #[test]
    fn test_api_list_response_serialization() {
        let resp = ApiListResponse::new(
            vec![TestItem { id: 1, name: "x".into() }],
            1,
        );
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["total"], 1);
        assert_eq!(json["items"][0]["name"], "x");
    }

    #[test]
    fn test_api_list_response_empty() {
        let resp: ApiListResponse<TestItem> = ApiListResponse::new(vec![], 0);
        assert_eq!(resp.total, 0);
        assert!(resp.items.is_empty());
    }
}
