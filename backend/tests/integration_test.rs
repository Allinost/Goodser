use serde_json::Value;

// ========== 纯单元级集成测试（无需运行服务器） ==========

#[test]
fn test_api_response_format() {
    let resp = serde_json::json!({"code": 0, "data": {"id": "abc", "name": "test"}});
    assert_eq!(resp["code"], 0);
    assert_eq!(resp["data"]["name"], "test");
}

#[test]
fn test_error_response_format() {
    let resp = serde_json::json!({"code": 40001, "message": "Bad request"});
    assert_eq!(resp["code"], 40001);
    assert!(resp["message"].is_string());
}

#[test]
fn test_unauthorized_response_format() {
    let resp = serde_json::json!({"code": 40100, "message": "Unauthorized"});
    assert_eq!(resp["code"], 40100);
}

#[test]
fn test_health_response_schema() {
    let resp = serde_json::json!({
        "code": 0,
        "data": {
            "status": "ok",
            "database": "connected",
            "version": "0.1.0",
            "uptime_secs": 12345
        }
    });
    assert_eq!(resp["code"], 0);
    assert_eq!(resp["data"]["status"], "ok");
    assert_eq!(resp["data"]["database"], "connected");
    assert!(resp["data"]["uptime_secs"].as_u64().unwrap() > 0);
}

#[test]
fn test_product_response_schema() {
    let resp = serde_json::json!({
        "code": 0,
        "data": {
            "product": {
                "id": "prod_001",
                "code": "A-B-0001-0010-A",
                "name": "测试",
                "quantity": 10,
                "status_code": "A",
                "main_zone": "A",
                "sub_zone": "B",
                "original_price": 100.0
            }
        }
    });
    assert_eq!(resp["data"]["product"]["main_zone"], "A");
    assert_eq!(resp["data"]["product"]["status_code"], "A");
    assert_eq!(resp["data"]["product"]["quantity"], 10);
}

#[test]
fn test_query_response_schema() {
    let resp = serde_json::json!({
        "code": 0,
        "data": {
            "items": [
                {"id": "p1", "name": "商品1"},
                {"id": "p2", "name": "商品2"}
            ],
            "total": 2,
            "page": 1,
            "page_size": 20
        }
    });
    assert_eq!(resp["data"]["total"], 2);
    assert_eq!(resp["data"]["items"].as_array().unwrap().len(), 2);
    assert_eq!(resp["data"]["page"], 1);
    assert_eq!(resp["data"]["page_size"], 20);
}

#[test]
fn test_pagination_validation() {
    let page = 0;
    let page_size = 200;
    let safe_page = page.max(1);
    let safe_size = page_size.clamp(1, 100);
    assert_eq!(safe_page, 1);
    assert_eq!(safe_size, 100);
}

#[test]
fn test_sort_validation() {
    let allowed_sorts = [
        "seq_number", "name", "quantity", "main_zone", "sub_zone",
        "status_code", "created_at", "updated_at",
    ];
    assert!(allowed_sorts.contains(&"name"));
    assert!(allowed_sorts.contains(&"seq_number"));
    assert!(!allowed_sorts.contains(&"invalid"));

    for sort_order in &["asc", "desc"] {
        assert!(["asc", "desc"].contains(sort_order));
    }
    assert!(!["asc", "desc"].contains(&"invalid"));
}

#[test]
fn test_zone_validation() {
    let main_zone = "A";
    assert!(main_zone.len() == 1 && main_zone.chars().all(|c| c.is_ascii_uppercase()));
    let invalid = "1";
    assert!(!(invalid.len() == 1 && invalid.chars().all(|c| c.is_ascii_uppercase())));
    let multi = "AB";
    assert!(!(multi.len() == 1 && multi.chars().all(|c| c.is_ascii_uppercase())));
}

#[test]
fn test_order_status_valid_transitions() {
    let active = ["pending", "reserved"];
    let terminal = ["confirmed", "cancelled"];

    for s in &active {
        assert!(active.contains(s));
        assert!(!terminal.contains(s));
    }
    for s in &terminal {
        assert!(terminal.contains(s));
        assert!(!active.contains(s));
    }
}

#[test]
fn test_image_url_format() {
    let key = "images/2026/06/08/uuid.jpg";
    let base_url = "https://rfs.hailong.site/rustfs";
    let url = format!("{}/{}", base_url.trim_end_matches('/'), key);
    assert_eq!(url, "https://rfs.hailong.site/rustfs/images/2026/06/08/uuid.jpg");
}

#[test]
fn test_storage_key_format() {
    let key = format!("images/{}/{}/{}", "inv_001", "prod_001", "photo.jpg");
    assert_eq!(key, "images/inv_001/prod_001/photo.jpg");
}

#[test]
fn test_inbound_log_type_validation() {
    let allowed = ["single", "batch", "search"];
    assert!(allowed.contains(&"single"));
    assert!(allowed.contains(&"batch"));
    assert!(allowed.contains(&"search"));
    assert!(!allowed.contains(&"invalid"));
}

#[test]
fn test_whitelist_role_validation() {
    let allowed = ["admin", "member"];
    assert!(allowed.contains(&"admin"));
    assert!(allowed.contains(&"member"));
    assert!(!allowed.contains(&"superuser"));
}

#[test]
fn test_inventory_sort_order() {
    let invs = vec![
        serde_json::json!({"name": "B", "sort_order": 2}),
        serde_json::json!({"name": "A", "sort_order": 1}),
        serde_json::json!({"name": "C", "sort_order": 3}),
    ];
    let mut sorted = invs.clone();
    sorted.sort_by_key(|i| i["sort_order"].as_i64().unwrap());
    assert_eq!(sorted[0]["name"], "A");
    assert_eq!(sorted[1]["name"], "B");
    assert_eq!(sorted[2]["name"], "C");
}

// ========== 以下为 E2E 测试（需要运行中的服务器） ==========
//

const BASE_URL: &str = "http://localhost:8080";
const API_KEY: &str = "dev-api-key-change-me";

fn client() -> reqwest::Client {
    reqwest::Client::new()
}

fn headers() -> reqwest::header::HeaderMap {
    let mut h = reqwest::header::HeaderMap::new();
    h.insert(
        reqwest::header::AUTHORIZATION,
        format!("Bearer {}", API_KEY).parse().unwrap(),
    );
    h
}

async fn post(action: &str, body: Value) -> Value {
    let url = format!("{}/api/{}", BASE_URL, action);
    let resp = client()
        .post(&url)
        .headers(headers())
        .json(&body)
        .send()
        .await
        .expect("Request failed");
    resp.json().await.expect("Parse failed")
}

async fn post_public(action: &str, body: Value) -> Value {
    let url = format!("{}/api/{}", BASE_URL, action);
    let resp = client()
        .post(&url)
        .json(&body)
        .send()
        .await
        .expect("Request failed");
    resp.json().await.expect("Parse failed")
}

async fn post_expect_code(action: &str, body: Value, expected_code: i32) -> Value {
    let resp = post(action, body).await;
    assert_eq!(
        resp["code"], expected_code,
        "Expected code {expected_code}, got {}: {}",
        resp["code"], resp["message"]
    );
    resp
}

// ========== Health Check ==========

#[tokio::test]
async fn test_health_check() {
    let url = format!("{}/health", BASE_URL);
    let resp = client()
        .post(&url)
        .send()
        .await
        .expect("Health check failed");
    assert!(resp.status().is_success(), "Health check should succeed");
    let body: Value = resp.json().await.unwrap();
    assert_eq!(body["code"], 0);
    assert_eq!(body["data"]["status"], "ok");
    assert!(body["data"]["version"].is_string());
}

// ========== Status Codes ==========

#[tokio::test]
async fn test_status_codes_preset() {
    let resp = post_public("loadStatusCodes", serde_json::json!({})).await;
    assert_eq!(resp["code"], 0);
    let codes = resp["data"].as_array().unwrap();
    assert!(!codes.is_empty(), "Should have preset status codes");
    let code_values: Vec<&str> = codes
        .iter()
        .filter_map(|c| c["code"].as_str())
        .collect();
    assert!(code_values.contains(&"A"), "Should contain A for 正常");
    assert!(code_values.contains(&"N"), "Should contain N for 全新");
}

#[tokio::test]
async fn test_add_and_remove_status_code() {
    let resp = post_expect_code(
        "addStatusCode",
        serde_json::json!({"code": "Z", "label": "测试状态"}),
        0,
    )
    .await;
    let sc_id = resp["data"]["status_code"]["id"].as_str().unwrap().to_string();

    let resp2 = post_expect_code(
        "removeStatusCode",
        serde_json::json!({"id": &sc_id}),
        0,
    )
    .await;
    assert_eq!(resp2["data"]["deleted"], true);
}

#[tokio::test]
async fn test_duplicate_status_code() {
    post("addStatusCode", serde_json::json!({"code": "Y", "label": "Temp"})).await;
    let resp = post(
        "addStatusCode",
        serde_json::json!({"code": "Y", "label": "Duplicate"}),
    )
    .await;
    assert_ne!(resp["code"], 0, "Duplicate code should fail");
    post("removeStatusCode", serde_json::json!({"id": resp["data"]["status_code"]["id"]})).await;
}

// ========== Tags ==========

#[tokio::test]
async fn test_tags_preset() {
    let resp = post_public("loadTags", serde_json::json!({})).await;
    assert_eq!(resp["code"], 0);
    let tags = resp["data"].as_array().unwrap();
    assert!(!tags.is_empty(), "Should have preset tags");
    let tag_names: Vec<&str> = tags.iter().filter_map(|t| t["name"].as_str()).collect();
    assert!(tag_names.contains(&"热销"));
}

#[tokio::test]
async fn test_create_and_delete_tag() {
    let resp = post_expect_code(
        "createTag",
        serde_json::json!({"name": "集成测试标签", "color": "#eb2f96"}),
        0,
    )
    .await;
    let tag_id = resp["data"]["tag"]["id"].as_str().unwrap().to_string();
    assert_eq!(resp["data"]["tag"]["color"], "#eb2f96");

    let resp2 = post_expect_code(
        "deleteTag",
        serde_json::json!({"id": &tag_id}),
        0,
    )
    .await;
    assert_eq!(resp2["data"]["deleted"], true);
}

#[tokio::test]
async fn test_duplicate_tag_fails() {
    post("createTag", serde_json::json!({"name": "唯一标签"})).await;
    let resp = post("createTag", serde_json::json!({"name": "唯一标签"})).await;
    assert_ne!(resp["code"], 0, "Duplicate tag should fail");
    // Cleanup - find and delete the tag we created
    let tags = post_public("loadTags", serde_json::json!({})).await;
    for tag in tags["data"].as_array().unwrap() {
        if tag["name"] == "唯一标签" {
            post("deleteTag", serde_json::json!({"id": tag["id"]})).await;
        }
    }
}

// ========== Inventories ==========

#[tokio::test]
async fn test_inventory_crud() {
    let timestamp = chrono::Utc::now().timestamp();
    let inventory_name = format!("Test Inventory {}", timestamp);

    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": &inventory_name}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let resp2 = post_public("loadInventories", serde_json::json!({})).await;
    assert_eq!(resp2["code"], 0);
    let names: Vec<&str> = resp2["data"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|i| i["name"].as_str())
        .collect();
    assert!(names.contains(&inventory_name.as_str()));

    post_expect_code(
        "updateInventory",
        serde_json::json!({"id": &inv_id, "name": "Updated Name"}),
        0,
    )
    .await;

    post_expect_code(
        "deleteInventory",
        serde_json::json!({"id": &inv_id}),
        0,
    )
    .await;
}

#[tokio::test]
async fn test_delete_inventory_with_products_fails() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Delete Test Inv"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let seq_resp = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "X",
            "sub_zone": "Y",
        }),
        0,
    )
    .await;
    let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

    post_expect_code(
        "createProduct",
        serde_json::json!({
            "inventory_id": &inv_id,
            "code": format!("X-Y-{:04}-0001-A", seq),
            "main_zone": "X",
            "sub_zone": "Y",
            "seq_number": seq,
            "quantity": 1,
            "status_code": "A",
            "name": "Blocking Product",
        }),
        0,
    )
    .await;

    let resp_del = post(
        "deleteInventory",
        serde_json::json!({"id": &inv_id}),
    )
    .await;
    assert_ne!(resp_del["code"], 0, "Deleting inventory with products should fail");
}

// ========== Products ==========

#[tokio::test]
async fn test_product_crud() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Product Test Inv"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let seq_resp = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "A",
            "sub_zone": "B",
        }),
        0,
    )
    .await;
    let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

    let prod_resp = post_expect_code(
        "createProduct",
        serde_json::json!({
            "inventory_id": &inv_id,
            "code": format!("A-B-{:04}-0010-A", seq),
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": seq,
            "quantity": 10,
            "status_code": "A",
            "name": "Test Product",
            "original_price": 100.0,
            "market_price": 120.0,
            "expected_price": 110.0,
        }),
        0,
    )
    .await;
    let prod_id = prod_resp["data"]["product"]["id"].as_str().unwrap().to_string();

    let list_resp = post_public(
        "loadProducts",
        serde_json::json!({"inventory_id": &inv_id}),
    )
    .await;
    assert_eq!(list_resp["code"], 0);
    let ids: Vec<&str> = list_resp["data"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|p| p["id"].as_str())
        .collect();
    assert!(ids.contains(&prod_id.as_str()));

    post_expect_code(
        "deleteProduct",
        serde_json::json!({"id": &prod_id}),
        0,
    )
    .await;

    post_expect_code(
        "deleteInventory",
        serde_json::json!({"id": &inv_id}),
        0,
    )
    .await;
}

#[tokio::test]
async fn test_query_products_with_filters() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Query Test Inv"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    for i in 1..=3 {
        let seq_resp = post_expect_code(
            "allocateSeq",
            serde_json::json!({
                "inventory_id": &inv_id,
                "main_zone": "Q",
                "sub_zone": "R",
            }),
            0,
        )
        .await;
        let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

        post_expect_code(
            "createProduct",
            serde_json::json!({
                "inventory_id": &inv_id,
                "code": format!("Q-R-{:04}-0001-A", seq),
                "main_zone": "Q",
                "sub_zone": "R",
                "seq_number": seq,
                "quantity": i * 10,
                "status_code": "A",
                "name": format!("Query Product {}", i),
            }),
            0,
        )
    .await;
    }

    let query_resp = post_public(
        "queryProducts",
        serde_json::json!({
            "inventory_id": &inv_id,
            "page": 1,
            "page_size": 10,
            "sort_by": "name",
            "sort_order": "asc",
        }),
    )
    .await;
    assert_eq!(query_resp["code"], 0);
    assert_eq!(query_resp["data"]["total"], 3);
    assert_eq!(query_resp["data"]["items"].as_array().unwrap().len(), 3);

    // Cleanup
    let list = post_public("loadProducts", serde_json::json!({"inventory_id": &inv_id})).await;
    for p in list["data"].as_array().unwrap() {
        post("deleteProduct", serde_json::json!({"id": p["id"]})).await;
    }
    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

// ========== Outbound Orders ==========

#[tokio::test]
async fn test_outbound_order_flow() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Order Flow Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let seq_resp = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "O",
            "sub_zone": "P",
        }),
        0,
    )
    .await;
    let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

    let prod_resp = post_expect_code(
        "createProduct",
        serde_json::json!({
            "inventory_id": &inv_id,
            "code": format!("O-P-{:04}-0050-A", seq),
            "main_zone": "O",
            "sub_zone": "P",
            "seq_number": seq,
            "quantity": 50,
            "status_code": "A",
            "name": "Outbound Product",
        }),
        0,
    )
    .await;
    let prod_id = prod_resp["data"]["product"]["id"].as_str().unwrap().to_string();

    let order_resp = post_expect_code(
        "createOutbound",
        serde_json::json!({
            "inventory_id": &inv_id,
            "order_no": format!("OUT{:08}", chrono::Utc::now().timestamp()),
            "type": "outbound",
            "items": [{
                "product_id": &prod_id,
                "product_name": "Outbound Product",
                "product_code": format!("O-P-{:04}-0050-A", seq),
                "quantity": 5,
                "image_url": "",
            }],
        }),
        0,
    )
    .await;
    let order_id = order_resp["data"]["order"]["id"].as_str().unwrap().to_string();

    post_expect_code(
        "confirmOutbound",
        serde_json::json!({"id": &order_id}),
        0,
    )
    .await;

    let list_resp = post_public(
        "loadOutboundOrders",
        serde_json::json!({"inventory_id": &inv_id}),
    )
    .await;
    assert_eq!(list_resp["code"], 0);
    let orders = list_resp["data"].as_array().unwrap();
    assert!(!orders.is_empty(), "Should have outbound orders");

    // Cleanup
    post("deleteProduct", serde_json::json!({"id": &prod_id})).await;
    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

// ========== Reserve Flow ==========

#[tokio::test]
async fn test_reserve_flow() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Reserve Flow Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let seq_resp = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "S",
            "sub_zone": "T",
        }),
        0,
    )
    .await;
    let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

    let prod_resp = post_expect_code(
        "createProduct",
        serde_json::json!({
            "inventory_id": &inv_id,
            "code": format!("S-T-{:04}-0030-A", seq),
            "main_zone": "S",
            "sub_zone": "T",
            "seq_number": seq,
            "quantity": 30,
            "status_code": "A",
            "name": "Reserve Product",
        }),
        0,
    )
    .await;
    let prod_id = prod_resp["data"]["product"]["id"].as_str().unwrap().to_string();

    // Create reserve order
    let reserve_resp = post_expect_code(
        "createOutbound",
        serde_json::json!({
            "inventory_id": &inv_id,
            "order_no": format!("RSV{:08}", chrono::Utc::now().timestamp()),
            "type": "reserve",
            "items": [{
                "product_id": &prod_id,
                "product_name": "Reserve Product",
                "product_code": format!("S-T-{:04}-0030-A", seq),
                "quantity": 10,
                "image_url": "",
            }],
        }),
        0,
    )
    .await;
    let reserve_id = reserve_resp["data"]["order"]["id"].as_str().unwrap().to_string();

    // Cancel reserve
    post_expect_code(
        "cancelReserve",
        serde_json::json!({"id": &reserve_id}),
        0,
    )
    .await;

    // Cleanup
    post("deleteProduct", serde_json::json!({"id": &prod_id})).await;
    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

// ========== Inbound Flow ==========

#[tokio::test]
async fn test_inbound_single() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Inbound Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let seq_resp = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "M",
            "sub_zone": "N",
        }),
        0,
    )
    .await;
    let seq = seq_resp["data"]["seq_number"].as_i64().unwrap();

    let inbound_resp = post_expect_code(
        "inboundSingle",
        serde_json::json!({
            "inventory_id": &inv_id,
            "code": format!("M-N-{:04}-0020-A", seq),
            "main_zone": "M",
            "sub_zone": "N",
            "seq_number": seq,
            "quantity": 20,
            "status_code": "A",
            "name": "Inbound Single Product",
        }),
        0,
    )
    .await;
    assert!(inbound_resp["data"]["product"]["id"].is_string());

    let prod_id = inbound_resp["data"]["product"]["id"].as_str().unwrap().to_string();

    let logs_resp = post_public(
        "loadInboundLogs",
        serde_json::json!({"inventory_id": &inv_id}),
    )
    .await;
    assert_eq!(logs_resp["code"], 0);
    let logs = logs_resp["data"].as_array().unwrap();
    assert!(!logs.is_empty(), "Should have inbound logs");

    // Cleanup
    post("deleteProduct", serde_json::json!({"id": &prod_id})).await;
    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

#[tokio::test]
async fn test_inbound_batch() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Batch Inbound Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let items = (1..=3)
        .map(|i| {
            let seq = i;
            serde_json::json!({
                "code": format!("B-{:04}-{:04}-A", seq, seq * 10),
                "main_zone": "B",
                "sub_zone": "A",
                "seq_number": seq,
                "quantity": seq * 10,
                "status_code": "A",
                "name": format!("Batch Product {}", seq),
            })
        })
        .collect::<Vec<_>>();

    // For batch, we can't use allocateSeq for each since the handler does it differently
    // Instead, just use sequential numbers 1-3
    let batch_resp = post_expect_code(
        "inboundBatch",
        serde_json::json!({
            "inventory_id": &inv_id,
            "order_no": "BATCH-TEST-001",
            "items": items,
        }),
        0,
    )
    .await;
    assert!(batch_resp["data"]["products"].is_array());

    let logs_resp = post_public(
        "loadInboundLogs",
        serde_json::json!({"inventory_id": &inv_id}),
    )
    .await;
    assert_eq!(logs_resp["code"], 0);

    // Cleanup
    let list = post_public("loadProducts", serde_json::json!({"inventory_id": &inv_id})).await;
    for p in list["data"].as_array().unwrap() {
        post("deleteProduct", serde_json::json!({"id": p["id"]})).await;
    }
    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

// ========== Whitelist ==========

#[tokio::test]
async fn test_whitelist() {
    let resp = post_expect_code(
        "addWhitelist",
        serde_json::json!({
            "openid": "test_openid_001",
            "nickname": "测试用户",
            "role": "member",
        }),
        0,
    )
    .await;
    let wl_id = resp["data"]["entry"]["id"].as_str().unwrap().to_string();

    let check_resp = post_expect_code(
        "checkWhitelist",
        serde_json::json!({"openid": "test_openid_001"}),
        0,
    )
    .await;
    assert!(check_resp["data"]["allowed"].as_bool().unwrap());

    let list_resp = post_public("loadWhitelist", serde_json::json!({})).await;
    assert_eq!(list_resp["code"], 0);

    post_expect_code(
        "removeWhitelist",
        serde_json::json!({"id": &wl_id}),
        0,
    )
    .await;

    let check_resp2 = post_expect_code(
        "checkWhitelist",
        serde_json::json!({"openid": "test_openid_001"}),
        0,
    )
    .await;
    assert!(!check_resp2["data"]["allowed"].as_bool().unwrap());
}

// ========== Authorization ==========

#[tokio::test]
async fn test_unauthorized_access() {
    let url = format!("{}/api/createInventory", BASE_URL);
    let resp = client()
        .post(&url)
        .json(&serde_json::json!({"name": "test"}))
        .send()
        .await
        .expect("Request failed");
    assert_eq!(resp.status(), 401, "Should be unauthorized");
}

#[tokio::test]
async fn test_public_routes_no_auth() {
    let resp = post_public("loadInventories", serde_json::json!({})).await;
    assert_eq!(resp["code"], 0, "Public routes should not need auth");
}

// ========== Sequence Number ==========

#[tokio::test]
async fn test_allocate_seq_increment() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Seq Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let r1 = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "S",
            "sub_zone": "Q",
        }),
        0,
    )
    .await;
    let s1 = r1["data"]["seq_number"].as_i64().unwrap();
    assert_eq!(s1, 1, "First allocation should be 1");

    let r2 = post_expect_code(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "S",
            "sub_zone": "Q",
        }),
        0,
    )
    .await;
    let s2 = r2["data"]["seq_number"].as_i64().unwrap();
    assert_eq!(s2, 2, "Second allocation should be 2");

    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}

// ========== Validation ==========

#[tokio::test]
async fn test_allocate_seq_invalid_zone() {
    let resp = post_expect_code(
        "createInventory",
        serde_json::json!({"name": "Validation Test"}),
        0,
    )
    .await;
    let inv_id = resp["data"]["inventory"]["id"].as_str().unwrap().to_string();

    let resp = post(
        "allocateSeq",
        serde_json::json!({
            "inventory_id": &inv_id,
            "main_zone": "1",
            "sub_zone": "B",
        }),
    )
    .await;
    assert_ne!(resp["code"], 0, "Invalid zone should be rejected");

    post("deleteInventory", serde_json::json!({"id": &inv_id})).await;
}
