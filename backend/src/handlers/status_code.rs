use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::status_code::*;

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

pub async fn load_status_codes(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<StatusCode>>> {
    let codes = repo.list_status_codes().await?;
    Ok(Json(ApiResponse::ok(codes)))
}

pub async fn add_status_code(
    State(repo): State<MysqlRepository>,
    Json(req): Json<AddStatusCodeRequest>,
) -> JsonResult<ApiResponse<StatusCode>> {
    let sc = repo.add_status_code(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(sc)))
}

pub async fn update_status_code(
    State(repo): State<MysqlRepository>,
    Json(req): Json<UpdateStatusCodeRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    repo.update_status_code(&req).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn remove_status_code(
    State(repo): State<MysqlRepository>,
    Json(req): Json<RemoveStatusCodeRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.remove_status_code(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn list_status_codes_rest(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<StatusCode>>> {
    let codes = repo.list_status_codes().await?;
    Ok(Json(ApiResponse::ok(codes)))
}

pub async fn add_status_code_rest(
    State(repo): State<MysqlRepository>,
    Json(req): Json<AddStatusCodeRequest>,
) -> JsonResult<ApiResponse<StatusCode>> {
    let sc = repo.add_status_code(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(sc)))
}

pub async fn remove_status_code_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.remove_status_code(&id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_status_code() -> StatusCode {
        StatusCode {
            id: "sc_a".into(),
            code: "A".into(),
            label: "正常".into(),
            is_system: true,
            owner_openid: "system".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        }
    }

    #[test]
    fn test_status_code_serializes_with_underscore_id() {
        let sc = sample_status_code();
        let json = serde_json::to_value(&sc).unwrap();
        assert_eq!(json["_id"], "sc_a");
        assert_eq!(json["code"], "A");
        assert_eq!(json["label"], "正常");
    }

    #[test]
    fn test_status_code_system_flag() {
        let sc = sample_status_code();
        let json = serde_json::to_value(&sc).unwrap();
        assert!(json["is_system"].as_bool().unwrap());
    }

    #[test]
    fn test_status_code_custom() {
        let sc = StatusCode {
            id: "sc_g".into(),
            code: "G".into(),
            label: "自定义".into(),
            is_system: false,
            owner_openid: "user_001".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-06-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&sc).unwrap();
        assert!(!json["is_system"].as_bool().unwrap());
    }

    #[test]
    fn test_deleted_data_serde() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_status_codes_in_api_response() {
        let codes = vec![sample_status_code()];
        let resp = ApiResponse::ok(codes);
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["data"].as_array().unwrap().len(), 1);
        assert_eq!(json["data"][0]["code"], "A");
    }

    #[test]
    fn test_add_status_code_request_serde() {
        let json = serde_json::json!({"code": "G", "label": "自定义"});
        let req: AddStatusCodeRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.code, "G");
        assert_eq!(req.label, "自定义");
    }
}
