use axum::extract::{Path, State};
use axum::Json;
use serde::Serialize;

use crate::db::MysqlRepository;
use crate::handlers::{ApiResponse, JsonResult};
use crate::models::whitelist::*;

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

#[derive(Serialize)]
pub struct CheckData {
    allowed: bool,
    user: Option<WhitelistEntry>,
}

pub async fn load_whitelist(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<WhitelistEntry>>> {
    let entries = repo.list_whitelist().await?;
    Ok(Json(ApiResponse::ok(entries)))
}

pub async fn add_whitelist(
    State(repo): State<MysqlRepository>,
    Json(req): Json<AddWhitelistRequest>,
) -> JsonResult<ApiResponse<WhitelistEntry>> {
    let entry = repo.add_whitelist(&req).await?;
    Ok(Json(ApiResponse::ok(entry)))
}

pub async fn remove_whitelist(
    State(repo): State<MysqlRepository>,
    Json(req): Json<RemoveWhitelistRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.remove_whitelist(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn check_whitelist(
    State(repo): State<MysqlRepository>,
    Json(req): Json<serde_json::Value>,
) -> JsonResult<ApiResponse<CheckData>> {
    let openid = req.get("openid").and_then(|v| v.as_str()).unwrap_or("");
    let allowed = repo.check_whitelist(openid).await?;
    let user = if allowed {
        repo.list_whitelist().await.ok().and_then(|entries| {
            entries.into_iter().find(|e| e.openid == openid)
        })
    } else {
        None
    };
    Ok(Json(ApiResponse::ok(CheckData {
        allowed,
        user,
    })))
}

pub async fn list_whitelist_rest(
    State(repo): State<MysqlRepository>,
) -> JsonResult<ApiResponse<Vec<WhitelistEntry>>> {
    let entries = repo.list_whitelist().await?;
    Ok(Json(ApiResponse::ok(entries)))
}

pub async fn add_whitelist_rest(
    State(repo): State<MysqlRepository>,
    Json(req): Json<AddWhitelistRequest>,
) -> JsonResult<ApiResponse<WhitelistEntry>> {
    let entry = repo.add_whitelist(&req).await?;
    Ok(Json(ApiResponse::ok(entry)))
}

pub async fn remove_whitelist_rest(
    State(repo): State<MysqlRepository>,
    Path(id): Path<String>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.remove_whitelist(&id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_entry() -> WhitelistEntry {
        WhitelistEntry {
            id: "wl_001".into(),
            openid: "openid_abc".into(),
            nickname: Some("张三".into()),
            avatar_url: None,
            role: "admin".into(),
            added_by: Some("system".into()),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        }
    }

    #[test]
    fn test_whitelist_entry_serializes_with_underscore_id() {
        let entry = sample_entry();
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["_id"], "wl_001");
        assert_eq!(json["openid"], "openid_abc");
        assert_eq!(json["role"], "admin");
    }

    #[test]
    fn test_deleted_data_serde() {
        let data = DeletedData { deleted: true };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["deleted"].as_bool().unwrap());
    }

    #[test]
    fn test_check_data_allowed() {
        let data = CheckData {
            allowed: true,
            user: None,
        };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["allowed"].as_bool().unwrap());
        assert!(json["user"].is_null());
    }

    #[test]
    fn test_check_data_not_allowed() {
        let data = CheckData {
            allowed: false,
            user: None,
        };
        let json = serde_json::to_value(&data).unwrap();
        assert!(!json["allowed"].as_bool().unwrap());
    }

    #[test]
    fn test_check_data_with_user() {
        let user_entry = WhitelistEntry {
            id: "wl_001".into(),
            openid: "openid_abc".into(),
            nickname: Some("张三".into()),
            avatar_url: None,
            role: "admin".into(),
            added_by: Some("system".into()),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let data = CheckData {
            allowed: true,
            user: Some(user_entry),
        };
        let json = serde_json::to_value(&data).unwrap();
        assert!(json["allowed"].as_bool().unwrap());
        assert_eq!(json["user"]["_id"], "wl_001");
        assert_eq!(json["user"]["openid"], "openid_abc");
    }

    #[test]
    fn test_add_whitelist_request_serde() {
        let json = serde_json::json!({
            "openid": "openid_xyz",
            "nickname": "测试用户",
            "role": "member"
        });
        let req: AddWhitelistRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.openid, "openid_xyz");
        assert_eq!(req.nickname.as_deref(), Some("测试用户"));
        assert_eq!(req.role.as_deref(), Some("member"));
    }

    #[test]
    fn test_whitelist_entry_member_role() {
        let entry = WhitelistEntry {
            role: "member".into(),
            ..sample_entry()
        };
        assert_eq!(entry.role, "member");
    }
}
