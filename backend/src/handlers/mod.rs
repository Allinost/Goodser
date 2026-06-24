pub mod health;
pub mod image;
pub mod inbound;
pub mod inventory;
pub mod order;
pub mod product;
pub mod status_code;
pub mod tag;
pub mod whitelist;

use serde::Serialize;

use crate::error::AppResult;

#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub code: i32,
    pub data: T,
}

#[derive(Serialize)]
pub struct ApiMessage {
    pub code: i32,
    pub message: String,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { code: 0, data }
    }
}

impl ApiMessage {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            code: 0,
            message: message.into(),
        }
    }

    #[allow(dead_code)]
    pub fn err(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

pub type JsonResult<T> = AppResult<axum::Json<T>>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_api_response_ok() {
        let resp = ApiResponse::ok(42);
        assert_eq!(resp.code, 0);
        assert_eq!(resp.data, 42);
    }

    #[test]
    fn test_api_response_serialization() {
        let resp = ApiResponse::ok("hello");
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"], "hello");
    }

    #[test]
    fn test_api_message_ok() {
        let msg = ApiMessage::ok("success");
        assert_eq!(msg.code, 0);
        assert_eq!(msg.message, "success");
    }

    #[test]
    fn test_api_message_err() {
        let msg = ApiMessage::err(40001, "bad request");
        assert_eq!(msg.code, 40001);
        assert_eq!(msg.message, "bad request");
    }
}
