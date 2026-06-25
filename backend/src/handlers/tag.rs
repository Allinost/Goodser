use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::tag::*;

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

pub async fn load_tags(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<Tag>>> {
    let tags = repo.list_tags().await?;
    Ok(Json(ApiResponse::ok(tags)))
}

pub async fn create_tag(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateTagRequest>,
) -> JsonResult<ApiResponse<Tag>> {
    let tag = repo.create_tag(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(tag)))
}

pub async fn update_tag(
    State(repo): State<MysqlRepository>,
    Json(req): Json<UpdateTagRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    repo.update_tag(&req).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_tag(
    State(repo): State<MysqlRepository>,
    Json(req): Json<DeleteTagRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_tag(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn list_tags_rest(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<Tag>>> {
    let tags = repo.list_tags().await?;
    Ok(Json(ApiResponse::ok(tags)))
}

pub async fn create_tag_rest(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateTagRequest>,
) -> JsonResult<ApiResponse<Tag>> {
    let tag = repo.create_tag(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(tag)))
}

pub async fn update_tag_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
    Json(req): Json<UpdateTagRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    let mut update = req;
    update.id = id;
    repo.update_tag(&update).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_tag_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_tag(&id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_tag() -> Tag {
        Tag {
            id: "tag_001".into(),
            name: "热销".into(),
            color: "#ff4d4f".into(),
            owner_openid: "user_001".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        }
    }

    #[test]
    fn test_tag_serializes_with_underscore_id() {
        let tag = sample_tag();
        let json = serde_json::to_value(&tag).unwrap();
        assert_eq!(json["_id"], "tag_001");
        assert_eq!(json["name"], "热销");
        assert_eq!(json["color"], "#ff4d4f");
    }

    #[test]
    fn test_tag_in_api_response() {
        let tag = sample_tag();
        let resp = ApiResponse::ok(tag);
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["_id"], "tag_001");
    }

    #[test]
    fn test_tag_deleted_data() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_create_tag_request_validation() {
        let req = CreateTagRequest {
            name: "  ".into(),
            color: None,
        };
        assert_eq!(req.name.trim(), "");
    }
}
