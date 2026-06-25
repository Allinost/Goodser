pub mod rustfs;

use async_trait::async_trait;

use crate::error::AppResult;

#[async_trait]
pub trait ImageStorage: Send + Sync {
    async fn upload(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<String>;
    async fn delete(&self, key: &str) -> AppResult<()>;
    async fn url(&self, key: &str) -> AppResult<String>;
    async fn exists(&self, _key: &str) -> AppResult<bool> {
        Ok(false)
    }
    async fn presign_upload(&self, key: &str, content_type: &str, expires_in_secs: u64) -> AppResult<String>;
    async fn presign_download(&self, key: &str, expires_in_secs: u64) -> AppResult<String>;
}
