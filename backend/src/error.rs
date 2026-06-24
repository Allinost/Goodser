use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub code: i32,
    pub message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, code, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, 40400, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, 40001, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, 40900, msg.clone()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, 40100, "Unauthorized".into()),
            AppError::Database(e) => {
                tracing::error!("Database error: {e}");
                (StatusCode::INTERNAL_SERVER_ERROR, 50000, "Internal server error".into())
            }
            AppError::Storage(msg) => (StatusCode::INTERNAL_SERVER_ERROR, 50001, msg.clone()),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {msg}");
                (StatusCode::INTERNAL_SERVER_ERROR, 50000, "Internal server error".into())
            }
        };

        let body = ErrorResponse { code, message };
        (status, Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_not_found_format() {
        let err = AppError::NotFound("Inventory inv_001 not found".into());
        assert_eq!(
            err.to_string(),
            "Not found: Inventory inv_001 not found"
        );
    }

    #[test]
    fn test_bad_request_format() {
        let err = AppError::BadRequest("Invalid zone".into());
        assert_eq!(err.to_string(), "Bad request: Invalid zone");
    }

    #[test]
    fn test_conflict_format() {
        let err = AppError::Conflict("Tag name already exists".into());
        assert_eq!(err.to_string(), "Conflict: Tag name already exists");
    }

    #[test]
    fn test_unauthorized_format() {
        let err = AppError::Unauthorized;
        assert_eq!(err.to_string(), "Unauthorized");
    }

    #[test]
    fn test_error_response_serialization() {
        let resp = ErrorResponse {
            code: 40001,
            message: "Invalid input".into(),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["code"], 40001);
        assert_eq!(json["message"], "Invalid input");
    }

    #[test]
    fn test_not_found_http_status() {
        let err = AppError::NotFound("test".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[test]
    fn test_bad_request_http_status() {
        let err = AppError::BadRequest("test".into());
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_unauthorized_http_status() {
        let err = AppError::Unauthorized;
        let response = err.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_database_error_conversion() {
        let db_err = sqlx::Error::RowNotFound;
        let app_err: AppError = db_err.into();
        assert!(matches!(app_err, AppError::Database(_)));
    }
}
