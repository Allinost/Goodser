use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct WhitelistEntry {
    #[serde(rename(serialize = "_id"))]
    pub id: String,
    pub openid: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub role: String,
    pub added_by: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddWhitelistRequest {
    pub openid: String,
    pub nickname: Option<String>,
    pub avatar_url: Option<String>,
    pub role: Option<String>,
    pub added_by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RemoveWhitelistRequest {
    pub id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_whitelist_entry_serialization() {
        let entry = WhitelistEntry {
            id: "wl_001".into(),
            openid: "openid_abc123".into(),
            nickname: Some("张三".into()),
            avatar_url: Some("http://example.com/avatar.png".into()),
            role: "admin".into(),
            added_by: Some("system".into()),
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&entry).unwrap();
        assert_eq!(json["openid"], "openid_abc123");
        assert_eq!(json["role"], "admin");
        assert_eq!(json["nickname"], "张三");
    }

    #[test]
    fn test_add_whitelist_request_default_role() {
        let json = serde_json::json!({
            "openid": "openid_xyz"
        });
        let req: AddWhitelistRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.openid, "openid_xyz");
        assert!(req.role.is_none());
        assert!(req.nickname.is_none());
    }

    #[test]
    fn test_add_whitelist_request_full() {
        let req = AddWhitelistRequest {
            openid: "openid_001".into(),
            nickname: Some("管理员".into()),
            avatar_url: Some("http://example.com/avatar.png".into()),
            role: Some("admin".into()),
            added_by: Some("system".into()),
        };
        let json = serde_json::to_value(&req).unwrap();
        assert_eq!(json["role"], "admin");
        assert_eq!(json["nickname"], "管理员");
    }

    #[test]
    fn test_whitelist_entry_with_none_optionals() {
        let entry = WhitelistEntry {
            id: "wl_002".into(),
            openid: "openid_002".into(),
            nickname: None,
            avatar_url: None,
            role: "member".into(),
            added_by: None,
            created_at: NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        assert!(entry.nickname.is_none());
        assert!(entry.avatar_url.is_none());
        assert!(entry.added_by.is_none());
    }
}
