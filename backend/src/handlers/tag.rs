use axum::extract::State;
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::tag::*;

#[derive(Serialize)]
pub struct TagData {
    tag: Tag,
}

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
) -> JsonResult<ApiResponse<TagData>> {
    let tag = repo.create_tag(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(TagData { tag })))
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
    fn test_tag_data_serde() {
        let data = TagData { tag: sample_tag() };
        let json = serde_json::to_value(&data).unwrap();
        assert_eq!(json["tag"]["name"], "热销");
        assert_eq!(json["tag"]["color"], "#ff4d4f");
    }

    #[test]
    fn test_tag_data_in_api_response() {
        let resp = ApiResponse::ok(TagData { tag: sample_tag() });
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 0);
        assert_eq!(json["data"]["tag"]["name"], "热销");
    }

    #[test]
    fn test_tag_deleted_data() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_multiple_tags_in_api_response() {
        let tags = vec![
            TagData { tag: Tag { id: "t1".into(), name: "A".into(), ..sample_tag() } },
            TagData { tag: Tag { id: "t2".into(), name: "B".into(), ..sample_tag() } },
        ];
        let resp = ApiResponse::ok(tags);
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["data"].as_array().unwrap().len(), 2);
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
