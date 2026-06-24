mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod storage;

use axum::middleware::from_fn_with_state;
use axum::routing::post;
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use std::sync::Arc;

use axum::extract::FromRef;

use crate::config::AppConfig;
use crate::db::MysqlRepository;
use crate::handlers::*;
use crate::middleware::{auth_middleware, request_id_middleware};
use crate::storage::rustfs::RustFsStorage;
use crate::storage::ImageStorage;

impl FromRef<AppState> for MysqlRepository {
    fn from_ref(state: &AppState) -> Self {
        state.repo.clone()
    }
}

impl FromRef<AppState> for Arc<dyn ImageStorage> {
    fn from_ref(state: &AppState) -> Self {
        state.storage.clone()
    }
}



#[derive(Clone)]
pub struct AppState {
    pub repo: MysqlRepository,
    pub storage: std::sync::Arc<dyn ImageStorage>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let cfg = AppConfig::from_env();

    let repo = MysqlRepository::new(&cfg.database_url)
        .await
        .expect("Failed to connect to database");

    let storage: std::sync::Arc<dyn ImageStorage> = {
        let s = RustFsStorage::new(&cfg.rustfs);
        if let Err(e) = s.ensure_bucket().await {
            tracing::error!(error = %e, "RustFS bucket setup failed");
        }
        std::sync::Arc::new(s)
    };

    let api_key = cfg.api_key.clone();

    let app_state = AppState {
        repo: repo.clone(),
        storage,
    };

    let health_routes = Router::new()
        .route("/health", post(health::health_check));

    let public_routes = Router::new()
        .route("/api/loadInventories", post(inventory::load_inventories))
        .route("/api/loadProducts", post(product::load_products))
        .route("/api/queryProducts", post(product::query_products))
        .route("/api/loadOutboundOrders", post(order::load_outbound_orders))
        .route("/api/loadInboundLogs", post(inbound::load_inbound_logs))
        .route("/api/loadTags", post(tag::load_tags))
        .route("/api/loadStatusCodes", post(status_code::load_status_codes))
        .route("/api/loadWhitelist", post(whitelist::load_whitelist));

    let auth_routes = Router::new()
        .route("/api/createInventory", post(inventory::create_inventory))
        .route("/api/updateInventory", post(inventory::update_inventory))
        .route("/api/deleteInventory", post(inventory::delete_inventory))
        .route("/api/createProduct", post(product::create_product))
        .route("/api/updateProduct", post(product::update_product))
        .route("/api/deleteProduct", post(product::delete_product))
        .route("/api/allocateSeq", post(product::allocate_seq))
        .route("/api/inboundSingle", post(inbound::inbound_single))
        .route("/api/inboundBatch", post(inbound::inbound_batch))
        .route("/api/inboundSearchImport", post(inbound::inbound_search_import))
        .route("/api/createInboundLog", post(inbound::create_inbound_log))
        .route("/api/updateInboundLog", post(inbound::update_inbound_log))
        .route("/api/deleteInboundLog", post(inbound::delete_inbound_log))
        .route("/api/createOutbound", post(order::create_outbound))
        .route("/api/confirmOutbound", post(order::confirm_outbound))
        .route("/api/cancelOutbound", post(order::cancel_outbound))
        .route("/api/cancelReserve", post(order::cancel_reserve))
        .route("/api/reserveToOutbound", post(order::reserve_to_outbound))
        .route("/api/createTag", post(tag::create_tag))
        .route("/api/updateTag", post(tag::update_tag))
        .route("/api/deleteTag", post(tag::delete_tag))
        .route("/api/addWhitelist", post(whitelist::add_whitelist))
        .route("/api/removeWhitelist", post(whitelist::remove_whitelist))
        .route("/api/addStatusCode", post(status_code::add_status_code))
        .route("/api/updateStatusCode", post(status_code::update_status_code))
        .route("/api/removeStatusCode", post(status_code::remove_status_code))
        .route("/api/checkWhitelist", post(whitelist::check_whitelist))
        .route("/api/uploadImage", post(image::upload_image))
        .layer(from_fn_with_state(api_key, auth_middleware));

    let app = Router::new()
        .merge(health_routes)
        .merge(auth_routes)
        .merge(public_routes)
        .layer(axum::middleware::from_fn(request_id_middleware))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(app_state);

    let addr = cfg.addr();
    tracing::info!(addr = %addr, "Goodser backend starting");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .await
        .expect("Server failed");
}
