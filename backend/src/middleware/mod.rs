use axum::extract::Request;
use axum::middleware::Next;
use axum::response::Response;

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

    #[test]
    fn test_request_id_generation() {
        let id1 = uuid::Uuid::new_v4().to_string();
        let id2 = uuid::Uuid::new_v4().to_string();
        assert_ne!(id1, id2);
        assert_eq!(id1.len(), 36);
    }
}
