use sqlx::mysql::MySqlPoolOptions;
use sqlx::{MySql, Pool};

use crate::error::{AppError, AppResult};
use crate::models::inbound_log::*;
use crate::models::inventory::*;
use crate::models::order::*;
use crate::models::product::*;
use crate::models::status_code::*;
use crate::models::tag::*;
use crate::models::whitelist::*;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct InventoryStats {
    pub total_products: i64,
    pub total_quantity: i64,
    pub total_reserved: i64,
    pub zone_count: i64,
}

const MIGRATIONS: &[&str] = &[
    "CREATE TABLE IF NOT EXISTS inventories (
        id          VARCHAR(36) PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        owner_openid VARCHAR(255) NOT NULL,
        sort_order  INT NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_owner (owner_openid)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS products (
        id                VARCHAR(36) PRIMARY KEY,
        inventory_id      VARCHAR(36) NOT NULL,
        code              VARCHAR(50) NOT NULL,
        main_zone         CHAR(1) NOT NULL,
        sub_zone          CHAR(1) NOT NULL,
        seq_number        INT NOT NULL,
        quantity          INT NOT NULL DEFAULT 0,
        reserved_quantity INT NOT NULL DEFAULT 0,
        status_code       CHAR(1) NOT NULL DEFAULT 'A',
        name              VARCHAR(500) NOT NULL,
        original_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
        market_price      DECIMAL(12,2) NOT NULL DEFAULT 0,
        expected_price    DECIMAL(12,2) NOT NULL DEFAULT 0,
        remark            TEXT,
        storage_location  VARCHAR(255) DEFAULT '',
        image_url         VARCHAR(1024) DEFAULT '',
        image_list        JSON,
        tags              JSON,
        owner_openid      VARCHAR(255) NOT NULL,
        created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_inventory (inventory_id),
        INDEX idx_zone (inventory_id, main_zone, sub_zone),
        INDEX idx_seq (inventory_id, seq_number),
        INDEX idx_status (status_code),
        FULLTEXT INDEX ft_name (name)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS recycled_seq_numbers (
        id            VARCHAR(36) PRIMARY KEY,
        inventory_id  VARCHAR(36) NOT NULL,
        main_zone     CHAR(1) NOT NULL,
        sub_zone      CHAR(1) NOT NULL,
        seq_number    INT NOT NULL,
        recycled_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_zone_seq (inventory_id, main_zone, sub_zone, seq_number)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS seq_counters (
        id            VARCHAR(36) PRIMARY KEY,
        inventory_id  VARCHAR(36) NOT NULL,
        main_zone     CHAR(1) NOT NULL,
        sub_zone      CHAR(1) NOT NULL,
        current_max   INT NOT NULL DEFAULT 0,
        UNIQUE INDEX idx_unique_zone (inventory_id, main_zone, sub_zone)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS outbound_orders (
        id                VARCHAR(36) PRIMARY KEY,
        inventory_id      VARCHAR(36) NOT NULL,
        order_no          VARCHAR(50) NOT NULL,
        type              ENUM('outbound','reserve') NOT NULL DEFAULT 'outbound',
        status            ENUM('pending','reserved','confirmed','cancelled') NOT NULL DEFAULT 'pending',
        order_info        TEXT,
        remark            TEXT,
        items             JSON NOT NULL,
        source_reserve_id VARCHAR(36) DEFAULT NULL,
        owner_openid      VARCHAR(255) NOT NULL,
        created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        confirmed_at      DATETIME DEFAULT NULL,
        cancelled_at      DATETIME DEFAULT NULL,
        INDEX idx_inventory (inventory_id),
        INDEX idx_type (inventory_id, type),
        INDEX idx_status (inventory_id, status),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS inbound_logs (
        id            VARCHAR(36) PRIMARY KEY,
        inventory_id  VARCHAR(36) NOT NULL,
        order_no      VARCHAR(50) DEFAULT '',
        type          ENUM('single','batch','search') NOT NULL DEFAULT 'single',
        remark        TEXT,
        items         JSON NOT NULL,
        owner_openid  VARCHAR(255) NOT NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory (inventory_id),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS whitelist (
        id          VARCHAR(36) PRIMARY KEY,
        openid      VARCHAR(255) NOT NULL,
        nickname    VARCHAR(255) DEFAULT '',
        avatar_url  VARCHAR(1024) DEFAULT '',
        role        ENUM('admin','member') NOT NULL DEFAULT 'member',
        added_by    VARCHAR(255) DEFAULT NULL,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_openid (openid)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS status_codes (
        id            VARCHAR(36) PRIMARY KEY,
        code          CHAR(1) NOT NULL,
        label         VARCHAR(100) NOT NULL,
        is_system     BOOLEAN NOT NULL DEFAULT FALSE,
        owner_openid  VARCHAR(255) NOT NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_code (code)
    ) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS tags (
        id            VARCHAR(36) PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        color         VARCHAR(7) NOT NULL DEFAULT '#1890ff',
        owner_openid  VARCHAR(255) NOT NULL,
        created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_name (name)
    ) ENGINE=InnoDB",
];

const SEED_DATA: &[&str] = &[
    "INSERT IGNORE INTO status_codes (id, code, label, is_system, owner_openid) VALUES
        ('sc_a', 'A', '正常', TRUE, 'system'),
        ('sc_b', 'B', '预留', TRUE, 'system'),
        ('sc_c', 'C', '已拆', TRUE, 'system'),
        ('sc_d', 'D', '损坏', TRUE, 'system'),
        ('sc_e', 'E', '过期', TRUE, 'system'),
        ('sc_f', 'F', '停用', TRUE, 'system'),
        ('sc_n', 'N', '全新', TRUE, 'system')",
    "INSERT IGNORE INTO tags (id, name, color, owner_openid) VALUES
        ('tag_hot',     '热销', '#ff4d4f', 'system'),
        ('tag_new',     '新品', '#1890ff', 'system'),
        ('tag_clear',   '清仓', '#faad14', 'system'),
        ('tag_pre',     '预售', '#722ed1', 'system'),
        ('tag_digi',    '电子数码', '#13c2c2', 'system'),
        ('tag_access',  '配件', '#52c41a', 'system')",
];

#[derive(Clone)]
pub struct MysqlRepository {
    pool: Pool<MySql>,
}

impl MysqlRepository {
    pub async fn new(database_url: &str) -> AppResult<Self> {
        let pool = MySqlPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await
            .map_err(|e| {
                tracing::error!("Failed to connect to MySQL: {e}");
                AppError::Internal(format!("Database connection failed: {e}"))
            })?;
        let repo = Self { pool };
        repo.run_migrations().await?;
        Ok(repo)
    }

    async fn run_migrations(&self) -> AppResult<()> {
        for sql in MIGRATIONS {
            sqlx::query(sql).execute(&self.pool).await.map_err(|e| {
                tracing::error!("Migration failed: {e}");
                AppError::Internal(format!("Migration failed: {e}"))
            })?;
        }
        for sql in SEED_DATA {
            sqlx::query(sql).execute(&self.pool).await.map_err(|e| {
                tracing::error!("Seed data failed: {e}");
                AppError::Internal(format!("Seed data failed: {e}"))
            })?;
        }
        tracing::info!("Database migrations completed");
        Ok(())
    }

    pub fn pool(&self) -> &Pool<MySql> {
        &self.pool
    }

    // ======== Inventories ========

    pub async fn list_inventories(&self) -> AppResult<Vec<Inventory>> {
        sqlx::query_as::<_, Inventory>(
            "SELECT * FROM inventories ORDER BY sort_order ASC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn create_inventory(
        &self,
        req: &CreateInventoryRequest,
        openid: &str,
    ) -> AppResult<Inventory> {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO inventories (id, name, owner_openid) VALUES (?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.name)
        .bind(openid)
        .execute(&self.pool)
        .await?;
        self.get_inventory(&id).await
    }

    pub async fn get_inventory(&self, id: &str) -> AppResult<Inventory> {
        sqlx::query_as::<_, Inventory>(
            "SELECT * FROM inventories WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Inventory {id} not found")))
    }

    pub async fn get_inventory_stats(&self, id: &str) -> AppResult<InventoryStats> {
        let (total_products,): (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM products WHERE inventory_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        let (total_quantity,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(quantity), 0) FROM products WHERE inventory_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        let (total_reserved,): (i64,) = sqlx::query_as(
            "SELECT COALESCE(SUM(reserved_quantity), 0) FROM products WHERE inventory_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        let (zone_count,): (i64,) = sqlx::query_as(
            "SELECT COUNT(DISTINCT main_zone, sub_zone) FROM products WHERE inventory_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(InventoryStats { total_products, total_quantity, total_reserved, zone_count })
    }

    pub async fn update_inventory(&self, req: &UpdateInventoryRequest) -> AppResult<()> {
        let inv = self.get_inventory(&req.id).await?;
        let name = req.name.as_deref().unwrap_or(&inv.name);
        sqlx::query("UPDATE inventories SET name = ? WHERE id = ?")
            .bind(name)
            .bind(&req.id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_inventory(&self, id: &str) -> AppResult<()> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM products WHERE inventory_id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        if count.0 > 0 {
            return Err(AppError::BadRequest(
                "该目录下存在商品，无法删除".into(),
            ));
        }
        sqlx::query("DELETE FROM inventories WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        sqlx::query("DELETE FROM seq_counters WHERE inventory_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        sqlx::query("DELETE FROM recycled_seq_numbers WHERE inventory_id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ======== Products ========

    pub async fn list_products(&self, inventory_id: &str) -> AppResult<Vec<Product>> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM products WHERE inventory_id = ? ORDER BY seq_number ASC",
        )
        .bind(inventory_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn get_product(&self, id: &str) -> AppResult<Product> {
        sqlx::query_as::<_, Product>(
            "SELECT * FROM products WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Product {id} not found")))
    }

    pub async fn create_product(
        &self,
        req: &CreateProductRequest,
        openid: &str,
    ) -> AppResult<Product> {
        let id = uuid::Uuid::new_v4().to_string();
        let tags = req
            .tags
            .as_ref()
            .map(|t| serde_json::to_value(t).unwrap_or(serde_json::Value::Null))
            .unwrap_or(serde_json::Value::Null);
        sqlx::query(
            "INSERT INTO products (id, inventory_id, code, main_zone, sub_zone, \
             seq_number, quantity, status_code, name, original_price, \
             market_price, expected_price, remark, storage_location, \
             image_url, image_list, tags, owner_openid) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.inventory_id)
        .bind(&req.code)
        .bind(&req.main_zone)
        .bind(&req.sub_zone)
        .bind(req.seq_number)
        .bind(req.quantity.unwrap_or(0))
        .bind(&req.status_code)
        .bind(&req.name)
        .bind(req.original_price.unwrap_or(0.0))
        .bind(req.market_price.unwrap_or(0.0))
        .bind(req.expected_price.unwrap_or(0.0))
        .bind(req.remark.as_deref())
        .bind(req.storage_location.as_deref())
        .bind(req.image_url.as_deref())
        .bind(&serde_json::Value::Null)
        .bind(&tags)
        .bind(openid)
        .execute(&self.pool)
        .await?;
        self.get_product(&id).await
    }

    pub async fn update_product(&self, req: &UpdateProductRequest) -> AppResult<()> {
        let product = self.get_product(&req.id).await?;
        let name = req.name.as_deref().unwrap_or(&product.name);
        let code = req.code.as_deref().unwrap_or(&product.code);
        let main_zone = req.main_zone.as_deref().unwrap_or(&product.main_zone);
        let sub_zone = req.sub_zone.as_deref().unwrap_or(&product.sub_zone);
        let status_code = req.status_code.as_deref().unwrap_or(&product.status_code);
        let remark = req.remark.as_deref().or(product.remark.as_deref());
        let storage = req
            .storage_location
            .as_deref()
            .or(product.storage_location.as_deref());
        let image_url = req.image_url.as_deref().or(product.image_url.as_deref());
        let quantity = req.quantity.unwrap_or(product.quantity);
        let original_price = req.original_price.unwrap_or(product.original_price);
        let market_price = req.market_price.unwrap_or(product.market_price);
        let expected_price = req.expected_price.unwrap_or(product.expected_price);
        let seq_number = req.seq_number.unwrap_or(product.seq_number);
        let tags = req
            .tags
            .as_ref()
            .map(|t| serde_json::to_value(t).unwrap_or(serde_json::Value::Null))
            .unwrap_or(product.tags.unwrap_or(serde_json::Value::Null));
        sqlx::query(
            "UPDATE products SET name=?, code=?, main_zone=?, sub_zone=?, \
             seq_number=?, quantity=?, original_price=?, market_price=?, expected_price=?, \
             status_code=?, remark=?, storage_location=?, image_url=?, tags=? WHERE id=?",
        )
        .bind(name)
        .bind(code)
        .bind(main_zone)
        .bind(sub_zone)
        .bind(seq_number)
        .bind(quantity)
        .bind(original_price)
        .bind(market_price)
        .bind(expected_price)
        .bind(status_code)
        .bind(remark)
        .bind(storage)
        .bind(image_url)
        .bind(&tags)
        .bind(&req.id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn delete_product(&self, id: &str) -> AppResult<()> {
        let product = self.get_product(id).await?;
        let pending_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM outbound_orders \
             WHERE status IN ('pending','reserved') \
             AND JSON_CONTAINS(items, JSON_OBJECT('product_id', ?))",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        if pending_count.0 > 0 {
            return Err(AppError::BadRequest(
                "该商品有未完成的出库/预留单，无法删除".into(),
            ));
        }
        sqlx::query("DELETE FROM products WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        sqlx::query(
            "INSERT INTO recycled_seq_numbers (id, inventory_id, main_zone, sub_zone, seq_number) \
             VALUES (?, ?, ?, ?, ?)",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(&product.inventory_id)
        .bind(&product.main_zone)
        .bind(&product.sub_zone)
        .bind(product.seq_number)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn allocate_seq_number(
        &self,
        inventory_id: &str,
        main_zone: &str,
        sub_zone: &str,
    ) -> AppResult<i32> {
        let recycled: Option<(i32, String)> = sqlx::query_as(
            "SELECT seq_number, id FROM recycled_seq_numbers \
             WHERE inventory_id = ? AND main_zone = ? AND sub_zone = ? \
             ORDER BY seq_number ASC LIMIT 1",
        )
        .bind(inventory_id)
        .bind(main_zone)
        .bind(sub_zone)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((seq, recycled_id)) = recycled {
            sqlx::query("DELETE FROM recycled_seq_numbers WHERE id = ?")
                .bind(&recycled_id)
                .execute(&self.pool)
                .await?;
            return Ok(seq);
        }

        let counter: Option<(i32,)> = sqlx::query_as(
            "SELECT current_max FROM seq_counters \
             WHERE inventory_id = ? AND main_zone = ? AND sub_zone = ?",
        )
        .bind(inventory_id)
        .bind(main_zone)
        .bind(sub_zone)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((max,)) = counter {
            let new_max = max + 1;
            sqlx::query(
                "UPDATE seq_counters SET current_max = ? \
                 WHERE inventory_id = ? AND main_zone = ? AND sub_zone = ?",
            )
            .bind(new_max)
            .bind(inventory_id)
            .bind(main_zone)
            .bind(sub_zone)
            .execute(&self.pool)
            .await?;
            Ok(new_max)
        } else {
            sqlx::query(
                "INSERT INTO seq_counters (id, inventory_id, main_zone, sub_zone, current_max) \
                 VALUES (?, ?, ?, ?, 1)",
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(inventory_id)
            .bind(main_zone)
            .bind(sub_zone)
            .execute(&self.pool)
            .await?;
            Ok(1)
        }
    }

    // ======== Outbound Orders ========

    pub async fn list_outbound_orders(
        &self,
        inventory_id: &str,
    ) -> AppResult<Vec<OutboundOrder>> {
        sqlx::query_as::<_, OutboundOrder>(
            "SELECT * FROM outbound_orders WHERE inventory_id = ? ORDER BY created_at DESC",
        )
        .bind(inventory_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn get_outbound_order(&self, id: &str) -> AppResult<OutboundOrder> {
        sqlx::query_as::<_, OutboundOrder>(
            "SELECT * FROM outbound_orders WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Order {id} not found")))
    }

    pub async fn create_outbound_order(
        &self,
        req: &CreateOutboundRequest,
        openid: &str,
    ) -> AppResult<OutboundOrder> {
        let id = uuid::Uuid::new_v4().to_string();
        let order_type = req.order_type.as_deref().unwrap_or("outbound");
        let status = req.status.as_deref().unwrap_or("pending");
        let items_json = serde_json::to_value(&req.items)
            .unwrap_or(serde_json::Value::Array(vec![]));

        for item in &req.items {
            let available = self.check_available(&item.product_id).await?;
            if order_type == "outbound" && item.quantity > available {
                return Err(AppError::BadRequest(format!(
                    "「{}」可用库存不足: {}",
                    item.product_name, available
                )));
            }
            if order_type == "reserve" && item.quantity > available {
                return Err(AppError::BadRequest(format!(
                    "「{}」可预留不足: {}",
                    item.product_name, available
                )));
            }
        }

        for item in &req.items {
            if order_type == "outbound" {
                sqlx::query(
                    "UPDATE products SET quantity = quantity - ? WHERE id = ?",
                )
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;
            } else if order_type == "reserve" {
                sqlx::query(
                    "UPDATE products SET reserved_quantity = reserved_quantity + ? WHERE id = ?",
                )
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;
            }
        }

        sqlx::query(
            "INSERT INTO outbound_orders \
             (id, inventory_id, order_no, type, status, order_info, remark, \
              items, source_reserve_id, owner_openid) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.inventory_id)
        .bind(&req.order_no)
        .bind(order_type)
        .bind(status)
        .bind(req.order_info.as_deref())
        .bind(req.remark.as_deref())
        .bind(&items_json)
        .bind(req.source_reserve_id.as_deref())
        .bind(openid)
        .execute(&self.pool)
        .await?;
        self.get_outbound_order(&id).await
    }

    async fn check_available(&self, product_id: &str) -> AppResult<i32> {
        let product = self.get_product(product_id).await?;
        Ok(product.quantity - product.reserved_quantity)
    }

    pub async fn confirm_outbound(&self, id: &str) -> AppResult<()> {
        let order = self.get_outbound_order(id).await?;
        sqlx::query(
            "UPDATE outbound_orders SET status = 'confirmed', confirmed_at = NOW() \
             WHERE id = ?",
        )
        .bind(id)
        .execute(&self.pool)
        .await?;

        if order.order_type == "reserve" {
            let items: Vec<OrderItem> = serde_json::from_value(order.items.clone())
                .unwrap_or_default();
            for item in &items {
                sqlx::query(
                    "UPDATE products SET reserved_quantity = reserved_quantity - ? WHERE id = ?",
                )
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;
            }
        }
        Ok(())
    }

    pub async fn cancel_outbound(&self, id: &str) -> AppResult<()> {
        let order = self.get_outbound_order(id).await?;
        let items: Vec<OrderItem> = serde_json::from_value(order.items.clone())
            .unwrap_or_default();
        for item in &items {
            if order.order_type == "outbound" {
                sqlx::query(
                    "UPDATE products SET quantity = quantity + ? WHERE id = ?",
                )
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;
            }
        }
        sqlx::query(
            "UPDATE outbound_orders SET status = 'cancelled', cancelled_at = NOW() \
             WHERE id = ?",
        )
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn cancel_reserve(&self, id: &str) -> AppResult<()> {
        let order = self.get_outbound_order(id).await?;
        let items: Vec<OrderItem> = serde_json::from_value(order.items.clone())
            .unwrap_or_default();
        for item in &items {
            sqlx::query(
                "UPDATE products SET reserved_quantity = reserved_quantity - ? WHERE id = ?",
            )
            .bind(item.quantity)
            .bind(&item.product_id)
            .execute(&self.pool)
            .await?;
        }
        sqlx::query(
            "UPDATE outbound_orders SET status = 'cancelled', cancelled_at = NOW() \
             WHERE id = ?",
        )
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn reserve_to_outbound(
        &self,
        req: &ReserveToOutboundRequest,
        openid: &str,
    ) -> AppResult<OutboundOrder> {
        self.confirm_outbound(&req.id).await?;
        let create_req = CreateOutboundRequest {
            inventory_id: req.inventory_id.clone(),
            order_no: req.order_no.clone(),
            order_type: Some("outbound".into()),
            status: Some("pending".into()),
            order_info: req.order_info.clone(),
            remark: req.remark.clone(),
            items: req.items.clone(),
            source_reserve_id: Some(req.id.clone()),
        };
        self.create_outbound_order(&create_req, openid).await
    }

    // ======== Inbound Logs ========

    pub async fn list_inbound_logs(
        &self,
        inventory_id: &str,
    ) -> AppResult<Vec<InboundLog>> {
        sqlx::query_as::<_, InboundLog>(
            "SELECT * FROM inbound_logs WHERE inventory_id = ? ORDER BY created_at DESC",
        )
        .bind(inventory_id)
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn get_inbound_log(&self, id: &str) -> AppResult<InboundLog> {
        sqlx::query_as::<_, InboundLog>(
            "SELECT * FROM inbound_logs WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("InboundLog {id} not found")))
    }

    pub async fn create_inbound_log(
        &self,
        req: &CreateInboundLogRequest,
        openid: &str,
    ) -> AppResult<InboundLog> {
        let id = uuid::Uuid::new_v4().to_string();
        let log_type = req.log_type.as_deref().unwrap_or("single");
        let items_json = serde_json::to_value(&req.items)
            .unwrap_or(serde_json::Value::Array(vec![]));
        sqlx::query(
            "INSERT INTO inbound_logs (id, inventory_id, order_no, type, remark, items, owner_openid) \
             VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.inventory_id)
        .bind(req.order_no.as_deref())
        .bind(log_type)
        .bind(req.remark.as_deref())
        .bind(&items_json)
        .bind(openid)
        .execute(&self.pool)
        .await?;
        sqlx::query_as::<_, InboundLog>(
            "SELECT * FROM inbound_logs WHERE id = ?",
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn update_inbound_log(&self, req: &UpdateInboundLogRequest) -> AppResult<()> {
        if let Some(remark) = &req.remark {
            sqlx::query("UPDATE inbound_logs SET remark = ? WHERE id = ?")
                .bind(remark)
                .bind(&req.id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(items) = &req.items {
            let items_json = serde_json::to_value(items)
                .unwrap_or(serde_json::Value::Array(vec![]));
            sqlx::query("UPDATE inbound_logs SET items = ? WHERE id = ?")
                .bind(&items_json)
                .bind(&req.id)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    pub async fn delete_inbound_log(&self, id: &str) -> AppResult<()> {
        let log: InboundLog = sqlx::query_as(
            "SELECT * FROM inbound_logs WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("InboundLog {id} not found")))?;

        let items: Vec<InboundLogItem> = serde_json::from_value(log.items)
            .unwrap_or_default();
        for item in &items {
            sqlx::query("UPDATE products SET quantity = quantity - ? WHERE id = ?")
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;
        }
        sqlx::query("DELETE FROM inbound_logs WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ======== Tags ========

    pub async fn list_tags(&self) -> AppResult<Vec<Tag>> {
        sqlx::query_as::<_, Tag>("SELECT * FROM tags ORDER BY name ASC")
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)
    }

    pub async fn create_tag(&self, req: &CreateTagRequest, openid: &str) -> AppResult<Tag> {
        let existing: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM tags WHERE name = ?",
        )
        .bind(&req.name)
        .fetch_one(&self.pool)
        .await?;
        if existing.0 > 0 {
            return Err(AppError::Conflict("标签名称已存在".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let color = req.color.as_deref().unwrap_or("#1890ff");
        sqlx::query("INSERT INTO tags (id, name, color, owner_openid) VALUES (?, ?, ?, ?)")
            .bind(&id)
            .bind(&req.name)
            .bind(color)
            .bind(openid)
            .execute(&self.pool)
            .await?;
        sqlx::query_as::<_, Tag>("SELECT * FROM tags WHERE id = ?")
            .bind(&id)
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)
    }

    pub async fn update_tag(&self, req: &UpdateTagRequest) -> AppResult<()> {
        if let Some(name) = &req.name {
            sqlx::query("UPDATE tags SET name = ? WHERE id = ?")
                .bind(name)
                .bind(&req.id)
                .execute(&self.pool)
                .await?;
        }
        if let Some(color) = &req.color {
            sqlx::query("UPDATE tags SET color = ? WHERE id = ?")
                .bind(color)
                .bind(&req.id)
                .execute(&self.pool)
                .await?;
        }
        Ok(())
    }

    pub async fn delete_tag(&self, id: &str) -> AppResult<()> {
        let used: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM products WHERE JSON_CONTAINS(tags, JSON_QUOTE(?))",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        if used.0 > 0 {
            return Err(AppError::BadRequest("该标签下有商品，无法删除".into()));
        }
        sqlx::query("DELETE FROM tags WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ======== Status Codes ========

    pub async fn list_status_codes(&self) -> AppResult<Vec<StatusCode>> {
        sqlx::query_as::<_, StatusCode>("SELECT * FROM status_codes ORDER BY code ASC")
            .fetch_all(&self.pool)
            .await
            .map_err(AppError::from)
    }

    pub async fn add_status_code(
        &self,
        req: &AddStatusCodeRequest,
        openid: &str,
    ) -> AppResult<StatusCode> {
        let existing: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM status_codes WHERE code = ?",
        )
        .bind(&req.code)
        .fetch_one(&self.pool)
        .await?;
        if existing.0 > 0 {
            return Err(AppError::Conflict("状态编码已存在".into()));
        }
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO status_codes (id, code, label, owner_openid) VALUES (?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.code)
        .bind(&req.label)
        .bind(openid)
        .execute(&self.pool)
        .await?;
        sqlx::query_as::<_, StatusCode>("SELECT * FROM status_codes WHERE id = ?")
            .bind(&id)
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)
    }

    pub async fn update_status_code(&self, req: &UpdateStatusCodeRequest) -> AppResult<()> {
        if req.label.trim().is_empty() {
            return Err(AppError::BadRequest("状态名称不能为空".into()));
        }
        sqlx::query("UPDATE status_codes SET label = ? WHERE id = ?")
            .bind(req.label.trim())
            .bind(&req.id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn remove_status_code(&self, id: &str) -> AppResult<()> {
        let sc: StatusCode = sqlx::query_as("SELECT * FROM status_codes WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("StatusCode {id} not found")))?;
        if sc.is_system {
            return Err(AppError::BadRequest("系统预设状态编码不可删除".into()));
        }
        let used: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM products WHERE status_code = ?",
        )
        .bind(&sc.code)
        .fetch_one(&self.pool)
        .await?;
        if used.0 > 0 {
            return Err(AppError::BadRequest(
                "有商品正在使用此状态编码，无法删除".into(),
            ));
        }
        sqlx::query("DELETE FROM status_codes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    // ======== Whitelist ========

    pub async fn list_whitelist(&self) -> AppResult<Vec<WhitelistEntry>> {
        sqlx::query_as::<_, WhitelistEntry>(
            "SELECT * FROM whitelist ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }

    pub async fn add_whitelist(&self, req: &AddWhitelistRequest) -> AppResult<WhitelistEntry> {
        let id = uuid::Uuid::new_v4().to_string();
        let role = req.role.as_deref().unwrap_or("member");
        sqlx::query(
            "INSERT INTO whitelist (id, openid, nickname, avatar_url, role, added_by) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(&req.openid)
        .bind(req.nickname.as_deref())
        .bind(req.avatar_url.as_deref())
        .bind(role)
        .bind(req.added_by.as_deref())
        .execute(&self.pool)
        .await?;
        sqlx::query_as::<_, WhitelistEntry>("SELECT * FROM whitelist WHERE id = ?")
            .bind(&id)
            .fetch_one(&self.pool)
            .await
            .map_err(AppError::from)
    }

    pub async fn remove_whitelist(&self, id: &str) -> AppResult<()> {
        let entry: WhitelistEntry = sqlx::query_as(
            "SELECT * FROM whitelist WHERE id = ?",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Whitelist entry {id} not found")))?;

        if entry.role == "admin" {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM whitelist WHERE role = 'admin'",
            )
            .fetch_one(&self.pool)
            .await?;
            if count.0 <= 1 {
                return Err(AppError::BadRequest("不能移除唯一的管理员".into()));
            }
        }
        sqlx::query("DELETE FROM whitelist WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn check_whitelist(&self, openid: &str) -> AppResult<bool> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM whitelist WHERE openid = ?",
        )
        .bind(openid)
        .fetch_one(&self.pool)
        .await?;
        Ok(count.0 > 0)
    }

    // ======== Complex Inbound Operations ========

    pub async fn inbound_single(
        &self,
        req: &InboundSingleRequest,
        openid: &str,
    ) -> AppResult<(Product, InboundLog)> {
        let product_req = CreateProductRequest {
            inventory_id: req.inventory_id.clone(),
            code: req.code.clone(),
            main_zone: req.main_zone.clone(),
            sub_zone: req.sub_zone.clone(),
            seq_number: req.seq_number,
            quantity: req.quantity,
            status_code: req.status_code.clone(),
            name: req.name.clone(),
            original_price: req.original_price,
            market_price: req.market_price,
            expected_price: req.expected_price,
            remark: req.remark.clone(),
            storage_location: req.storage_location.clone(),
            image_url: req.image_url.clone(),
            tags: req.tags.clone(),
        };
        let product = self.create_product(&product_req, openid).await?;

        let log_item = InboundLogItem {
            product_id: product.id.clone(),
            product_name: product.name.clone(),
            product_code: product.code.clone(),
            quantity: product.quantity,
            image_url: product.image_url.clone(),
        };
        let log_req = CreateInboundLogRequest {
            inventory_id: req.inventory_id.clone(),
            order_no: req.order_no.clone(),
            log_type: Some("single".into()),
            remark: req.remark.clone(),
            items: vec![log_item],
        };
        let log = self.create_inbound_log(&log_req, openid).await?;
        Ok((product, log))
    }

    pub async fn inbound_batch(
        &self,
        req: &InboundBatchRequest,
        openid: &str,
    ) -> AppResult<Vec<Product>> {
        let mut products = Vec::new();
        let mut log_items = Vec::new();

        for item in &req.items {
            let product_req = CreateProductRequest {
                inventory_id: req.inventory_id.clone(),
                code: item.code.clone(),
                main_zone: item.main_zone.clone(),
                sub_zone: item.sub_zone.clone(),
                seq_number: item.seq_number,
                quantity: item.quantity,
                status_code: item.status_code.clone(),
                name: item.name.clone(),
                original_price: item.original_price,
                market_price: item.market_price,
                expected_price: item.expected_price,
                remark: item.remark.clone(),
                storage_location: item.storage_location.clone(),
                image_url: item.image_url.clone(),
                tags: item.tags.clone(),
            };
            match self.create_product(&product_req, openid).await {
                Ok(p) => {
                    log_items.push(InboundLogItem {
                        product_id: p.id.clone(),
                        product_name: p.name.clone(),
                        product_code: p.code.clone(),
                        quantity: p.quantity,
                        image_url: p.image_url.clone(),
                    });
                    products.push(p);
                }
                Err(e) => tracing::warn!("Batch inbound item failed: {e}"),
            }
        }

        if !log_items.is_empty() {
            let log_req = CreateInboundLogRequest {
                inventory_id: req.inventory_id.clone(),
                order_no: req.order_no.clone(),
                log_type: Some("batch".into()),
                remark: req.remark.clone(),
                items: log_items,
            };
            self.create_inbound_log(&log_req, openid).await?;
        }
        Ok(products)
    }

    pub async fn inbound_search_import(
        &self,
        req: &InboundSearchImportRequest,
        openid: &str,
    ) -> AppResult<()> {
        let mut log_items = Vec::new();
        for item in &req.items {
            sqlx::query("UPDATE products SET quantity = quantity + ? WHERE id = ?")
                .bind(item.quantity)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;

            // Update product code quantity segment to reflect new quantity
            let prod = self.get_product(&item.product_id).await?;
            let new_qty = prod.quantity;
            let parts: Vec<&str> = prod.code.split('-').collect();
            let new_code = if parts.len() >= 4 {
                format!("{}-{}-{}-{:04}-{}", parts[0], parts[1], parts[2], new_qty, parts[4])
            } else {
                prod.code.clone()
            };
            sqlx::query("UPDATE products SET code = ? WHERE id = ?")
                .bind(&new_code)
                .bind(&item.product_id)
                .execute(&self.pool)
                .await?;

            log_items.push(InboundLogItem {
                product_id: item.product_id.clone(),
                product_name: item.product_name.clone(),
                product_code: item.product_code.clone(),
                quantity: item.quantity,
                image_url: item.image_url.clone(),
            });
        }
        let log_req = CreateInboundLogRequest {
            inventory_id: req.inventory_id.clone(),
            order_no: req.order_no.clone(),
            log_type: Some("search".into()),
            remark: req.remark.clone(),
            items: log_items,
        };
        self.create_inbound_log(&log_req, openid).await?;
        Ok(())
    }
}
