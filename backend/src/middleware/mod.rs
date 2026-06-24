use axum::extract::{Request, State};
use axum::http::header::AUTHORIZATION;
use axum::middleware::Next;
use axum::response::Response;

use crate::error::AppError;

pub async fn auth_middleware(
    State(api_key): State<String>,
    req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let token = header.strip_prefix("Bearer ").unwrap_or("");

    if token.is_empty() {
        return Err(AppError::Unauthorized);
    }

    if token != api_key {
        let path = req.uri().path();
        tracing::warn!("Auth failed for {path}: invalid API key (len={})", token.len());
        return Err(AppError::Unauthorized);
    }

    Ok(next.run(req).await)
}

pub async fn request_id_middleware(
    req: Request,
    next: Next,
) -> Response {
    let request_id = req
        .headers()
        .get("X-Request-Id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            uuid::Uuid::new_v4().to_string()
        });

    let path = req.uri().path().to_string();
    let method = req.method().to_string();

    let span = tracing::info_span!(
        "request",
        request_id = %request_id,
        method = %method,
        path = %path,
    );
    let _guard = span.enter();

    let response = next.run(req).await;

    let status = response.status();
    tracing::info!(status = %status, "response");

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use axum::middleware::from_fn_with_state;
    use axum::routing::get;
    use axum::Router;
    use tower::util::ServiceExt;

    #[tokio::test]
    async fn test_auth_middleware_valid_key() {
        let api_key = "test-key".to_string();
        let app = Router::new()
            .route("/api/test", get(|| async { "ok" }))
            .layer(from_fn_with_state(api_key.clone(), auth_middleware))
            .with_state(());

        let req = Request::builder()
            .uri("/api/test")
            .header(AUTHORIZATION, "Bearer test-key")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_key() {
        let api_key = "test-key".to_string();
        let app = Router::new()
            .route("/api/test", get(|| async { "ok" }))
            .layer(from_fn_with_state(api_key, auth_middleware))
            .with_state(());

        let req = Request::builder()
            .uri("/api/test")
            .header(AUTHORIZATION, "Bearer wrong-key")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_auth_middleware_no_header() {
        let api_key = "test-key".to_string();
        let app = Router::new()
            .route("/api/test", get(|| async { "ok" }))
            .layer(from_fn_with_state(api_key, auth_middleware))
            .with_state(());

        let req = Request::builder()
            .uri("/api/test")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);
    }

    #[test]
    fn test_request_id_generation() {
        let id1 = uuid::Uuid::new_v4().to_string();
        let id2 = uuid::Uuid::new_v4().to_string();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36);
    }
}
