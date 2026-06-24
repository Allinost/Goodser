use async_trait::async_trait;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::{Client, Config};

use crate::config::RustFsConfig;
use crate::error::{AppError, AppResult};
use crate::storage::ImageStorage;

pub struct RustFsStorage {
    client: Client,
    bucket: String,
    public_url: Option<String>,
    endpoint: String,
}

impl RustFsStorage {
    pub fn new(config: &RustFsConfig) -> Self {
        let credentials = Credentials::new(
            &config.access_key,
            &config.secret_key,
            None,
            None,
            "rustfs",
        );

        let cfg = Config::builder()
            .endpoint_url(&config.endpoint)
            .region(Region::new(config.region.clone()))
            .credentials_provider(credentials)
            .force_path_style(true)
            .build();

        let client = Client::from_conf(cfg);

        Self {
            client,
            bucket: config.bucket.clone(),
            public_url: config.public_url.clone(),
            endpoint: config.endpoint.clone(),
        }
    }

    pub async fn ensure_bucket(&self) -> AppResult<()> {
        match self
            .client
            .head_bucket()
            .bucket(&self.bucket)
            .send()
            .await
        {
            Ok(_) => {
                tracing::info!(bucket = %self.bucket, "Bucket accessible");
                Ok(())
            }
            Err(aws_sdk_s3::error::SdkError::ServiceError(err)) => {
                if matches!(
                    err.err(),
                    aws_sdk_s3::operation::head_bucket::HeadBucketError::NotFound(_)
                ) {
                    tracing::warn!(bucket = %self.bucket, "Bucket not found, attempting to create");
                    self.client
                        .create_bucket()
                        .bucket(&self.bucket)
                        .send()
                        .await
                        .map_err(|e| {
                            AppError::Storage(format!(
                                "Failed to create bucket {}: {e}",
                                self.bucket
                            ))
                        })?;
                    tracing::info!(bucket = %self.bucket, "Bucket created");
                } else {
                    tracing::warn!(
                        bucket = %self.bucket, ?err,
                        "Bucket service error — continuing. Storage ops may fail."
                    );
                }
                Ok(())
            }
            Err(e) => {
                tracing::warn!(
                    bucket = %self.bucket, error = %e,
                    "Could not verify bucket — continuing. Storage ops may fail."
                );
                Ok(())
            }
        }
    }

    #[allow(dead_code)]
    pub fn make_key(inventory_id: &str, product_id: &str, filename: &str) -> String {
        format!("images/{inventory_id}/{product_id}/{filename}")
    }

    #[allow(dead_code)]
    pub fn make_thumbnail_key(inventory_id: &str, product_id: &str, filename: &str) -> String {
        format!("images/{inventory_id}/{product_id}/thumb_{filename}")
    }
}

#[async_trait]
impl ImageStorage for RustFsStorage {
    async fn upload(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<String> {
        let body = ByteStream::from(data.to_vec());

        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(body)
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| {
                let msg = format!("S3 upload failed for {key}: {e}");
                AppError::Storage(msg)
            })?;

        self.url(key).await
    }

    async fn delete(&self, key: &str) -> AppResult<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| AppError::Storage(format!("S3 delete failed for {key}: {e}")))?;
        Ok(())
    }

    async fn url(&self, key: &str) -> AppResult<String> {
        if let Some(base) = &self.public_url {
            let url = format!("{}/{}", base.trim_end_matches('/'), key);
            Ok(url)
        } else {
            let url = format!("{}/{}/{}", self.endpoint.trim_end_matches('/'), self.bucket, key);
            Ok(url)
        }
    }

    async fn exists(&self, key: &str) -> AppResult<bool> {
        match self
            .client
            .head_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
        {
            Ok(_) => Ok(true),
            Err(aws_sdk_s3::error::SdkError::ServiceError(err))
                if matches!(err.err(), aws_sdk_s3::operation::head_object::HeadObjectError::NotFound(_)) =>
            {
                Ok(false)
            }
            Err(e) => Err(AppError::Storage(format!("S3 head failed for {key}: {e}"))),
        }
    }
}

impl std::fmt::Debug for RustFsStorage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RustFsStorage")
            .field("bucket", &self.bucket)
            .field("endpoint", &self.endpoint)
            .finish()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_make_key() {
        let key = RustFsStorage::make_key("inv_001", "prod_001", "main.jpg");
        assert_eq!(key, "images/inv_001/prod_001/main.jpg");
    }

    #[test]
    fn test_make_thumbnail_key() {
        let key = RustFsStorage::make_thumbnail_key("inv_001", "prod_001", "main.jpg");
        assert_eq!(key, "images/inv_001/prod_001/thumb_main.jpg");
    }

    #[test]
    fn test_make_key_with_spaces() {
        let key = RustFsStorage::make_key("inv 001", "prod 001", "my image.jpg");
        assert_eq!(key, "images/inv 001/prod 001/my image.jpg");
    }

    #[test]
    fn test_make_key_empty_product_id() {
        let key = RustFsStorage::make_key("inv_001", "", "image.jpg");
        assert_eq!(key, "images/inv_001//image.jpg");
    }

    #[test]
    fn test_debug_format() {
        let config = RustFsConfig {
            endpoint: "http://localhost:9000".into(),
            region: "us-east-1".into(),
            access_key: "test".into(),
            secret_key: "test".into(),
            bucket: "test-bucket".into(),
            public_url: None,
        };
        let storage = RustFsStorage::new(&config);
        let debug = format!("{storage:?}");
        assert!(debug.contains("test-bucket"));
        assert!(debug.contains("localhost"));
    }
}
