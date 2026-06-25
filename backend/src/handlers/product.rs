use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::db::MysqlRepository;
use crate::error::AppResult;
use crate::handlers::{ApiMessage, ApiResponse, JsonResult};
use crate::models::product::*;

#[derive(Serialize)]
pub struct DeletedData {
    deleted: bool,
}

#[derive(Serialize)]
pub struct AllocateData {
    seq_number: i32,
}

#[derive(Deserialize)]
pub struct QueryProductsRequest {
    pub inventory_id: String,
    pub keyword: Option<String>,
    pub status_code: Option<String>,
    pub main_zone: Option<String>,
    pub sub_zone: Option<String>,
    pub tag_id: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Serialize)]
pub struct QueryProductsResponse {
    pub items: Vec<Product>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

pub async fn load_products(
    State(repo): State<MysqlRepository>,
    Json(req): Json<LoadProductsRequest>,
) -> JsonResult<ApiResponse<Vec<Product>>> {
    let items = repo.list_products(&req.inventory_id).await?;
    Ok(Json(ApiResponse::ok(items)))
}

pub async fn query_products(
    State(repo): State<MysqlRepository>,
    Json(req): Json<QueryProductsRequest>,
) -> JsonResult<ApiResponse<QueryProductsResponse>> {
    let page = req.page.unwrap_or(1).max(1);
    let page_size = req.page_size.unwrap_or(20).clamp(1, 100);
    let offset = (page - 1) * page_size;
    let sort_by = req.sort_by.as_deref().unwrap_or("seq_number");
    let sort_order = req.sort_order.as_deref().unwrap_or("asc");

    let allowed_sorts = [
        "seq_number", "name", "quantity", "main_zone", "sub_zone",
        "status_code", "created_at", "updated_at",
    ];
    if !allowed_sorts.contains(&sort_by) {
        return Err(crate::error::AppError::BadRequest(format!(
            "Invalid sort field: {sort_by}"
        )));
    }
    if sort_order != "asc" && sort_order != "desc" {
        return Err(crate::error::AppError::BadRequest(format!(
            "Invalid sort order: {sort_order}"
        )));
    }

    let order_clause = format!("ORDER BY {} {}", sort_by, sort_order);

    let where_sql = {
        let mut clauses = vec!["inventory_id = ?".to_string()];
        if let Some(ref kw) = req.keyword {
            if !kw.is_empty() {
                clauses.push("(name LIKE ? OR code LIKE ? OR remark LIKE ?)".to_string());
            }
        }
        if let Some(ref sc) = req.status_code {
            if !sc.is_empty() {
                clauses.push("status_code = ?".to_string());
            }
        }
        if let Some(ref mz) = req.main_zone {
            if !mz.is_empty() {
                clauses.push("main_zone = ?".to_string());
            }
        }
        if let Some(ref sz) = req.sub_zone {
            if !sz.is_empty() {
                clauses.push("sub_zone = ?".to_string());
            }
        }
        if let Some(ref tid) = req.tag_id {
            if !tid.is_empty() {
                clauses.push("JSON_CONTAINS(tags, JSON_QUOTE(?))".to_string());
            }
        }
        clauses.join(" AND ")
    };

    let keyword_pat = req.keyword.as_ref().filter(|k| !k.is_empty()).map(|kw| format!("%{kw}%"));
    let count_sql = format!("SELECT COUNT(*) FROM products WHERE {where_sql}");
    let (total,): (i64,) = {
        let mut q = sqlx::query_as::<_, (i64,)>(&count_sql);
        q = q.bind(&req.inventory_id);
        if let Some(ref pat) = keyword_pat {
            q = q.bind(pat).bind(pat).bind(pat);
        }
        if let Some(ref sc) = req.status_code {
            if !sc.is_empty() {
                q = q.bind(sc);
            }
        }
        if let Some(ref mz) = req.main_zone {
            if !mz.is_empty() {
                q = q.bind(mz);
            }
        }
        if let Some(ref sz) = req.sub_zone {
            if !sz.is_empty() {
                q = q.bind(sz);
            }
        }
        if let Some(ref tid) = req.tag_id {
            if !tid.is_empty() {
                q = q.bind(tid);
            }
        }
        q.fetch_one(repo.pool()).await?
    };

    let data_sql = format!(
        "SELECT * FROM products WHERE {where_sql} {order_clause} LIMIT ? OFFSET ?"
    );
    let items: Vec<Product> = {
        let mut q = sqlx::query_as::<_, Product>(&data_sql);
        q = q.bind(&req.inventory_id);
        if let Some(ref pat) = keyword_pat {
            q = q.bind(pat).bind(pat).bind(pat);
        }
        if let Some(ref sc) = req.status_code {
            if !sc.is_empty() {
                q = q.bind(sc);
            }
        }
        if let Some(ref mz) = req.main_zone {
            if !mz.is_empty() {
                q = q.bind(mz);
            }
        }
        if let Some(ref sz) = req.sub_zone {
            if !sz.is_empty() {
                q = q.bind(sz);
            }
        }
        if let Some(ref tid) = req.tag_id {
            if !tid.is_empty() {
                q = q.bind(tid);
            }
        }
        q = q.bind(page_size).bind(offset);
        q.fetch_all(repo.pool()).await?
    };

    Ok(Json(ApiResponse::ok(QueryProductsResponse {
        items,
        total,
        page,
        page_size,
    })))
}

pub async fn create_product(
    State(repo): State<MysqlRepository>,
    Json(req): Json<CreateProductRequest>,
) -> JsonResult<ApiResponse<Product>> {
    validate_product_code(&req.main_zone, &req.sub_zone, &req.status_code)?;
    let product = repo.create_product(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(product)))
}

pub async fn update_product(
    State(repo): State<MysqlRepository>,
    Json(req): Json<UpdateProductRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    if let Some(ref mz) = req.main_zone {
        if mz.len() != 1 || !mz.chars().all(|c| c.is_ascii_uppercase()) {
            return Err(crate::error::AppError::BadRequest(
                "主分区必须为大写字母 A-Z".into(),
            ));
        }
    }
    repo.update_product(&req).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_product(
    State(repo): State<MysqlRepository>,
    Json(req): Json<DeleteProductRequest>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_product(&req.id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn allocate_seq(
    State(repo): State<MysqlRepository>,
    Json(req): Json<AllocateSeqRequest>,
) -> JsonResult<ApiResponse<AllocateData>> {
    if !req.main_zone.chars().all(|c| c.is_ascii_uppercase()) || req.main_zone.len() != 1 {
        return Err(crate::error::AppError::BadRequest(
            "主分区必须为大写字母 A-Z".into(),
        ));
    }
    if !req.sub_zone.chars().all(|c| c.is_ascii_uppercase()) || req.sub_zone.len() != 1 {
        return Err(crate::error::AppError::BadRequest(
            "子分区必须为大写字母 A-Z".into(),
        ));
    }
    let seq = repo
        .allocate_seq_number(&req.inventory_id, &req.main_zone, &req.sub_zone)
        .await?;
    Ok(Json(ApiResponse::ok(AllocateData { seq_number: seq })))
}

pub async fn list_products_rest(
    State(repo): State<MysqlRepository>,
    Path(inventory_id): Path<String>,
) -> JsonResult<ApiResponse<Vec<Product>>> {
    let items = repo.list_products(&inventory_id).await?;
    Ok(Json(ApiResponse::ok(items)))
}

pub async fn get_product_rest(
    State(repo): State<MysqlRepository>,
    Path((_inventory_id, product_id)): Path<(String, String)>,
) -> JsonResult<ApiResponse<Product>> {
    let product = repo.get_product(&product_id).await?;
    Ok(Json(ApiResponse::ok(product)))
}

pub async fn create_product_rest(
    State(repo): State<MysqlRepository>,
    Path(_inventory_id): Path<String>,
    Json(req): Json<CreateProductRequest>,
) -> JsonResult<ApiResponse<Product>> {
    validate_product_code(&req.main_zone, &req.sub_zone, &req.status_code)?;
    let product = repo.create_product(&req, "api_user").await?;
    Ok(Json(ApiResponse::ok(product)))
}

pub async fn update_product_rest(
    State(repo): State<MysqlRepository>,
    Path((_inventory_id, product_id)): Path<(String, String)>,
    Json(req): Json<UpdateProductRequest>,
) -> JsonResult<ApiResponse<ApiMessage>> {
    let mut update = req;
    update.id = product_id;
    if let Some(ref mz) = update.main_zone {
        if mz.len() != 1 || !mz.chars().all(|c| c.is_ascii_uppercase()) {
            return Err(crate::error::AppError::BadRequest(
                "主分区必须为大写字母 A-Z".into(),
            ));
        }
    }
    repo.update_product(&update).await?;
    Ok(Json(ApiResponse::ok(ApiMessage::ok("updated"))))
}

pub async fn delete_product_rest(
    State(repo): State<MysqlRepository>,
    Path((_inventory_id, product_id)): Path<(String, String)>,
) -> JsonResult<ApiResponse<DeletedData>> {
    repo.delete_product(&product_id).await?;
    Ok(Json(ApiResponse::ok(DeletedData { deleted: true })))
}

pub async fn search_products_rest(
    State(repo): State<MysqlRepository>,
    Path(inventory_id): Path<String>,
    Json(req): Json<serde_json::Value>,
) -> JsonResult<ApiResponse<QueryProductsResponse>> {
    let mut q = serde_json::from_value::<QueryProductsRequest>(req)
        .map_err(|e| crate::error::AppError::BadRequest(format!("Invalid request: {e}")))?;
    q.inventory_id = inventory_id;
    query_products(axum::extract::State(repo), Json(q)).await
}

fn validate_product_code(main_zone: &str, sub_zone: &str, status_code: &str) -> AppResult<()> {
    if main_zone.len() != 1 || !main_zone.chars().all(|c| c.is_ascii_uppercase()) {
        return Err(crate::error::AppError::BadRequest(
            "主分区必须为大写字母 A-Z".into(),
        ));
    }
    if sub_zone.len() != 1 || !sub_zone.chars().all(|c| c.is_ascii_uppercase()) {
        return Err(crate::error::AppError::BadRequest(
            "子分区必须为大写字母 A-Z".into(),
        ));
    }
    if status_code.len() != 1 || !status_code.chars().all(|c| c.is_ascii_uppercase()) {
        return Err(crate::error::AppError::BadRequest(
            "状态编码必须为大写字母 A-Z".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_product_code_ok() {
        assert!(validate_product_code("A", "B", "C").is_ok());
    }

    #[test]
    fn test_validate_product_code_invalid_main_zone() {
        let err = validate_product_code("1", "B", "C").unwrap_err();
        assert!(err.to_string().contains("主分区"));
    }

    #[test]
    fn test_validate_product_code_invalid_sub_zone() {
        let err = validate_product_code("A", "BB", "C").unwrap_err();
        assert!(err.to_string().contains("子分区"));
    }

    #[test]
    fn test_validate_product_code_invalid_status() {
        let err = validate_product_code("A", "B", "CC").unwrap_err();
        assert!(err.to_string().contains("状态编码"));
    }

    #[test]
    fn test_product_serializes_with_underscore_id() {
        let p = Product {
            id: "prod_001".into(),
            inventory_id: "inv_001".into(),
            code: "A-B-0001-0010-A".into(),
            main_zone: "A".into(),
            sub_zone: "B".into(),
            seq_number: 1,
            quantity: 10,
            reserved_quantity: 0,
            status_code: "A".into(),
            name: "测试商品".into(),
            original_price: 100.0,
            market_price: 120.0,
            expected_price: 110.0,
            remark: Some("备注".into()),
            storage_location: Some("A区-1架".into()),
            image_url: Some("http://example.com/img.jpg".into()),
            image_list: None,
            tags: Some(serde_json::json!(["tag_1", "tag_2"])),
            owner_openid: "user_001".into(),
            created_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
            updated_at: chrono::NaiveDateTime::parse_from_str("2026-01-01 00:00:00", "%Y-%m-%d %H:%M:%S").unwrap(),
        };
        let json = serde_json::to_value(&p).unwrap();
        assert_eq!(json["_id"], "prod_001");
        assert_eq!(json["name"], "测试商品");
    }

    #[test]
    fn test_query_products_request_serde() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "keyword": "test",
            "status_code": "A",
            "main_zone": "A",
            "sub_zone": "B",
            "page": 1,
            "page_size": 20,
            "sort_by": "name",
            "sort_order": "asc"
        });
        let req: QueryProductsRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.inventory_id, "inv_001");
        assert_eq!(req.keyword.as_deref(), Some("test"));
        assert_eq!(req.page, Some(1));
    }

    #[test]
    fn test_query_products_request_defaults() {
        let json = serde_json::json!({
            "inventory_id": "inv_001"
        });
        let req: QueryProductsRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.page, None);
        assert_eq!(req.sort_by, None);
    }

    #[test]
    fn test_allocate_seq_request_validation() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "main_zone": "A",
            "sub_zone": "B"
        });
        let req: AllocateSeqRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.main_zone, "A");
        assert_eq!(req.sub_zone, "B");
    }

    #[test]
    fn test_create_product_request_serde() {
        let json = serde_json::json!({
            "inventory_id": "inv_001",
            "code": "A-B-0001-0010-A",
            "main_zone": "A",
            "sub_zone": "B",
            "seq_number": 1,
            "quantity": 10,
            "status_code": "A",
            "name": "Test Product"
        });
        let req: CreateProductRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.name, "Test Product");
        assert_eq!(req.seq_number, 1);
        assert_eq!(req.quantity, Some(10));
    }
}
