use std::sync::Arc;

use axum::extract::{Multipart, State};
use axum::Json;
use serde::Serialize;

use crate::error::AppError;
use crate::handlers::{ApiResponse, JsonResult};
use crate::storage::ImageStorage;

#[derive(Serialize)]
pub struct UploadData {
    url: String,
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
}
