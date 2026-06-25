use std::sync::Arc;

use axum::extract::{Multipart, Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::storage::ImageStorage;

#[derive(Serialize)]
pub struct UploadData {
    url: String,
}

#[derive(Serialize)]
pub struct PresignData {
    url: String,
    key: String,
}

#[derive(Deserialize)]
pub struct PresignRequest {
    pub content_type: Option<String>,
    pub product_id: Option<String>,
}

#[derive(Deserialize)]
pub struct ConfirmRequest {
    pub key: String,
    pub product_id: Option<String>,
}

pub async fn upload_image(
    State(storage): State<Arc<dyn ImageStorage>>,
    mut multipart: Multipart,
) -> JsonResult<ApiResponse<UploadData>> {
    let field = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
        .ok_or_else(|| AppError::BadRequest("No file uploaded".into()))?;

    let file_name = field
        .file_name()
        .unwrap_or("image.jpg")
        .to_string();
    let content_type = field
        .content_type()
        .unwrap_or("image/jpeg")
        .to_string();
    let data = field
        .bytes()
        .await
        .map_err(|e| AppError::BadRequest(format!("Read error: {e}")))?;

    let ext = file_name
        .rsplit('.')
        .next()
        .unwrap_or("jpg");
    let key = format!(
        "images/{}/{}.{}",
        chrono::Utc::now().format("%Y/%m/%d"),
        uuid::Uuid::new_v4(),
        ext
    );

    let url = storage.upload(&key, &data, &content_type).await?;
    Ok(Json(ApiResponse::ok(UploadData { url })))
}

pub async fn presign_upload(
    State(storage): State<Arc<dyn ImageStorage>>,
    Json(req): Json<PresignRequest>,
) -> JsonResult<ApiResponse<PresignData>> {
    let content_type = req.content_type.unwrap_or_else(|| "image/jpeg".into());
    let key = format!(
        "images/{}/{}.jpg",
        chrono::Utc::now().format("%Y/%m/%d"),
        uuid::Uuid::new_v4()
    );
    let url = storage.presign_upload(&key, &content_type, 3600).await?;
    Ok(Json(ApiResponse::ok(PresignData { url, key })))
}

pub async fn confirm_upload(
    State(storage): State<Arc<dyn ImageStorage>>,
    Json(req): Json<ConfirmRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    if !storage.exists(&req.key).await.unwrap_or(false) {
        return Err(AppError::BadRequest("上传文件未找到，请重新上传".into()));
    }
    Ok(Json(ApiResponse::ok(ApiMessage::ok("upload confirmed"))))
}

pub async fn get_image_url(
    State(storage): State<Arc<dyn ImageStorage>>,
    Path(key): Path<String>,
) -> JsonResult<ApiResponse<UploadData>> {
    let url = storage.url(&key).await?;
    Ok(Json(ApiResponse::ok(UploadData { url })))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_upload_data_serde() {
        let data = UploadData {
            url: "https://rfs.hailong.site/rustfs/images/2026/06/08/uuid.jpg".into(),
        };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(
            json["url"],
            "https://rfs.hailong.site/rustfs/images/2026/06/08/uuid.jpg"
        );
    }

    #[test]
    fn test_upload_data_empty_url() {
        let data = UploadData { url: "".into() };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["url"], "");
    }

    #[test]
    fn test_upload_data_in_api_response() {
        let resp = ApiResponse::ok(UploadData {
            url: "https://example.com/img.jpg".into(),
        });
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["url"], "https://example.com/img.jpg");
    }

    #[test]
    fn test_presign_data_serde() {
        let data = PresignData {
            url: "https://rfs.example.com/presign?token=abc".into(),
            key: "images/2026/06/25/uuid.jpg".into(),
        };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["url"], "https://rfs.example.com/presign?token=abc");
        assert_eq!(json["key"], "images/2026/06/25/uuid.jpg");
    }

    #[test]
    fn test_presign_request_defaults() {
        let json = serde_json::json!({});
        let req: PresignRequest = serde_json::from_value(json).unwrap();
        assert!(req.content_type.is_none());
        assert!(req.product_id.is_none());
    }

    #[test]
    fn test_presign_request_with_content_type() {
        let json = serde_json::json!({
            "content_type": "image/png",
            "product_id": "prod_001"
        });
        let req: PresignRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.content_type.as_deref(), Some("image/png"));
        assert_eq!(req.product_id.as_deref(), Some("prod_001"));
    }

    #[test]
    fn test_confirm_request_serde() {
        let json = serde_json::json!({
            "key": "images/2026/06/25/uuid.jpg",
            "product_id": "prod_001"
        });
        let req: ConfirmRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.key, "images/2026/06/25/uuid.jpg");
        assert_eq!(req.product_id.as_deref(), Some("prod_001"));
    }

    #[test]
    fn test_presign_data_in_api_response() {
        let resp = ApiResponse::ok(PresignData {
            url: "https://example.com/presign".into(),
            key: "images/test.jpg".into(),
        });
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["key"], "images/test.jpg");
    }
}
