mod config;
mod db;
mod error;
mod handlers;
mod middleware;
mod models;
mod storage;

use axum::routing::{delete, get, post, put};
use axum::Router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use std::sync::Arc;

use axum::extract::FromRef;

use crate::config::AppConfig;
use crate::db::MysqlRepository;
use crate::handlers::*;
use crate::middleware::request_id_middleware;
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

    let app_state = AppState {
        repo: repo.clone(),
        storage,
    };

    let app = Router::new()
        // Legacy flat POST endpoints
        .route("/health", post(health::health_check))
        .route("/api/loadInventories", post(inventory::load_inventories))
        .route("/api/loadProducts", post(product::load_products))
        .route("/api/queryProducts", post(product::query_products))
        .route("/api/loadOutboundOrders", post(order::load_outbound_orders))
        .route("/api/loadInboundLogs", post(inbound::load_inbound_logs))
        .route("/api/loadTags", post(tag::load_tags))
        .route("/api/loadStatusCodes", post(status_code::load_status_codes))
        .route("/api/loadWhitelist", post(whitelist::load_whitelist))
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
        // RESTful Inventories
        .route("/api/inventories", get(inventory::list_inventories_rest))
        .route("/api/inventories", post(inventory::create_inventory_rest))
        .route("/api/inventories/{id}", put(inventory::update_inventory_rest))
        .route("/api/inventories/{id}", delete(inventory::delete_inventory_rest))
        .route("/api/inventories/{id}/stats", get(inventory::inventory_stats))
        // RESTful Products
        .route("/api/inventories/{id}/products", get(product::list_products_rest))
        .route("/api/inventories/{id}/products", post(product::create_product_rest))
        .route("/api/inventories/{id}/products/{pid}", get(product::get_product_rest))
        .route("/api/inventories/{id}/products/{pid}", put(product::update_product_rest))
        .route("/api/inventories/{id}/products/{pid}", delete(product::delete_product_rest))
        .route("/api/inventories/{id}/products/search", post(product::search_products_rest))
        // RESTful Inbound
        .route("/api/inventories/{id}/inbound/single", post(inbound::inbound_single_rest))
        .route("/api/inventories/{id}/inbound/batch", post(inbound::inbound_batch_rest))
        .route("/api/inventories/{id}/inbound/search-import", post(inbound::inbound_search_import_rest))
        .route("/api/inventories/{id}/inbound/logs", get(inbound::list_inbound_logs_rest))
        .route("/api/inventories/{id}/inbound/logs/{log_id}", get(inbound::get_inbound_log_rest))
        .route("/api/inventories/{id}/inbound/logs/{log_id}", put(inbound::update_inbound_log_rest))
        .route("/api/inventories/{id}/inbound/logs/{log_id}", delete(inbound::delete_inbound_log_rest))
        // RESTful Outbound
        .route("/api/inventories/{id}/outbound/orders", get(order::list_outbound_orders_rest))
        .route("/api/inventories/{id}/outbound/orders", post(order::create_outbound_order_rest))
        .route("/api/inventories/{id}/outbound/orders/{oid}", get(order::get_outbound_order_detail_rest))
        .route("/api/inventories/{id}/outbound/orders/{oid}/confirm", post(order::confirm_outbound_rest))
        .route("/api/inventories/{id}/outbound/orders/{oid}/cancel", post(order::cancel_outbound_rest))
        .route("/api/inventories/{id}/outbound/reserves", post(order::create_reserve_order_rest))
        .route("/api/inventories/{id}/outbound/reserves/{rid}/cancel", post(order::cancel_reserve_rest))
        .route("/api/inventories/{id}/outbound/reserves/{rid}/to-outbound", post(order::reserve_to_outbound_rest))
        // RESTful Images
        .route("/api/images/presign", post(image::presign_upload))
        .route("/api/images/confirm", post(image::confirm_upload))
        .route("/api/images/{key}/url", get(image::get_image_url))
        // RESTful Settings
        .route("/api/settings/whitelist", get(whitelist::list_whitelist_rest))
        .route("/api/settings/whitelist", post(whitelist::add_whitelist_rest))
        .route("/api/settings/whitelist/{id}", delete(whitelist::remove_whitelist_rest))
        .route("/api/settings/status-codes", get(status_code::list_status_codes_rest))
        .route("/api/settings/status-codes", post(status_code::add_status_code_rest))
        .route("/api/settings/status-codes/{id}", delete(status_code::remove_status_code_rest))
        .route("/api/settings/tags", get(tag::list_tags_rest))
        .route("/api/settings/tags", post(tag::create_tag_rest))
        .route("/api/settings/tags/{id}", put(tag::update_tag_rest))
        .route("/api/settings/tags/{id}", delete(tag::delete_tag_rest))
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
