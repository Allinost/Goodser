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
}
