use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    #[allow(dead_code)]
    pub api_key: String,
    pub rustfs: RustFsConfig,
    #[allow(dead_code)]
    pub upload_dir: String,
}

#[derive(Clone, Debug)]
pub struct RustFsConfig {
    pub endpoint: String,
    pub region: String,
    pub access_key: String,
    pub secret_key: String,
    pub bucket: String,
    pub public_url: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        Self::from_reader(|key| env::var(key))
    }

    fn from_reader<F>(get: F) -> Self
    where
        F: Fn(&str) -> Result<String, env::VarError>,
    {
        Self {
            host: get("APP_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: get("APP_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            database_url: get("DATABASE_URL")
                .expect("DATABASE_URL must be set"),
            api_key: get("API_KEY")
                .unwrap_or_else(|_| "dev-key".into()),
            rustfs: RustFsConfig {
                endpoint: get("RUSTFS_ENDPOINT")
                    .unwrap_or_else(|_| "http://localhost:9000".into()),
                region: get("RUSTFS_REGION")
                    .unwrap_or_else(|_| "us-east-1".into()),
                access_key: get("RUSTFS_ACCESS_KEY")
                    .expect("RUSTFS_ACCESS_KEY must be set"),
                secret_key: get("RUSTFS_SECRET_KEY")
                    .expect("RUSTFS_SECRET_KEY must be set"),
                bucket: get("RUSTFS_BUCKET")
                    .unwrap_or_else(|_| "2313391".into()),
                public_url: get("RUSTFS_PUBLIC_URL").ok(),
            },
            upload_dir: get("UPLOAD_DIR")
                .unwrap_or_else(|_| "/data/uploads".into()),
        }
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_env(pairs: &[(&str, &str)]) -> impl Fn(&str) -> Result<String, env::VarError> + '_ {
        let map: std::collections::HashMap<String, String> = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        move |key| match map.get(key) {
            Some(v) => Ok(v.clone()),
            None => Err(env::VarError::NotPresent),
        }
    }

    #[test]
    fn test_default_host() {
        let vars = mock_env(&[
            ("DATABASE_URL", "mysql://test@localhost/test"),
            ("RUSTFS_ACCESS_KEY", "test-key"),
            ("RUSTFS_SECRET_KEY", "test-secret"),
        ]);
        let cfg = AppConfig::from_reader(vars);
        assert_eq!(cfg.host, "0.0.0.0");
        assert_eq!(cfg.port, 8080);
    }

    #[test]
    fn test_custom_port() {
        let vars = mock_env(&[
            ("DATABASE_URL", "mysql://test@localhost/test"),
            ("RUSTFS_ACCESS_KEY", "test-key"),
            ("RUSTFS_SECRET_KEY", "test-secret"),
            ("APP_PORT", "3000"),
        ]);
        let cfg = AppConfig::from_reader(vars);
        assert_eq!(cfg.port, 3000);
    }

    #[test]
    fn test_rustfs_defaults() {
        let vars = mock_env(&[
            ("DATABASE_URL", "mysql://test@localhost/test"),
            ("RUSTFS_ACCESS_KEY", "test-key"),
            ("RUSTFS_SECRET_KEY", "test-secret"),
        ]);
        let cfg = AppConfig::from_reader(vars);
        assert_eq!(cfg.rustfs.bucket, "2313391");
        assert!(cfg.rustfs.public_url.is_none());
    }

    #[test]
    fn test_rustfs_custom_endpoint() {
        let vars = mock_env(&[
            ("DATABASE_URL", "mysql://test@localhost/test"),
            ("RUSTFS_ACCESS_KEY", "test-key"),
            ("RUSTFS_SECRET_KEY", "test-secret"),
            ("RUSTFS_ENDPOINT", "https://rfs.example.com"),
        ]);
        let cfg = AppConfig::from_reader(vars);
        assert_eq!(cfg.rustfs.endpoint, "https://rfs.example.com");
    }

    #[test]
    fn test_addr_format() {
        let vars = mock_env(&[
            ("DATABASE_URL", "mysql://test@localhost/test"),
            ("RUSTFS_ACCESS_KEY", "test-key"),
            ("RUSTFS_SECRET_KEY", "test-secret"),
            ("APP_HOST", "127.0.0.1"),
            ("APP_PORT", "9090"),
        ]);
        let cfg = AppConfig::from_reader(vars);
        assert_eq!(cfg.addr(), "127.0.0.1:9090");
    }

    #[test]
    #[should_panic(expected = "DATABASE_URL must be set")]
    fn test_database_url_required() {
        AppConfig::from_reader(|_| Err(env::VarError::NotPresent));
    }
}
