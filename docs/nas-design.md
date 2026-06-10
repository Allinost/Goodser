# Goodser NAS + 私有云版后端设计文档

> 版本：v1.0
> 日期：2026-06-09
> 适用范围：自建后端（NAS 服务器 + 私有云），不依赖微信云开发

---

## 目录

1. [总体架构](#1-总体架构)
2. [基础设施配置](#2-基础设施配置)
3. [数据库设计（MySQL）](#3-数据库设计mysql)
4. [Redis 缓存设计](#4-redis-缓存设计)
5. [对象存储设计（RustIO）](#5-对象存储设计rustio)
6. [API 接口设计](#6-api-接口设计)
7. [NAS 端服务部署](#7-nas-端服务部署)
8. [认证与安全](#8-认证与安全)
9. [数据迁移与备份](#9-数据迁移与备份)

---

## 1. 总体架构

```
┌───────────────────────────────────────────────────────┐
│                      微信小程序                         │
│                  (Goodser 前端)                         │
└─────────────┬─────────────────────────────────────────┘
              │ HTTPS (内网穿透 / 组网)
              ▼
┌──────────────────────────────────────────────────────┐
│                     NAS 服务器                         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │  MySQL   │  │  Redis    │  │  Goodser API     │  │
│  │  主数据库  │  │  缓存/会话 │  │  (Fastify/Koa)   │  │
│  └──────────┘  └───────────┘  └────────┬─────────┘  │
│                                         │             │
│  ┌──────────┐                          │             │
│  │PostgreSQL │  ← 备选分析/报表          │             │
│  └──────────┘                          │             │
│                                         │             │
└─────────────────────────────────────────┼─────────────┘
                                          │ S3 API
                                          ▼
┌──────────────────────────────────────────────────────┐
│                     私有云服务器                        │
│  ┌──────────────────────────────────────────────┐    │
│  │                 RustIO                        │    │
│  │           S3 兼容对象存储                       │    │
│  │         (商品图片 / 备份文件)                   │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 1.1 组件职责

| 组件 | 部署位置 | 职责 |
|------|---------|------|
| MySQL | NAS | 主业务数据库，存储所有业务数据 |
| PostgreSQL | NAS | 备选分析数据库（可选），复杂报表/统计 |
| Redis | NAS | 缓存热点数据、用户会话、序号分配锁、速率限制 |
| Goodser API | NAS | 业务逻辑层，提供 RESTful API |
| RustIO | 私有云 | S3 兼容对象存储，存储商品图片和数据备份 |

### 1.2 网络架构

```
小程序 → HTTPS → 公网入口（frp/内网穿透）→ NAS API (127.0.0.1:3000)
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
                  MySQL         Redis        RustIO (S3)
                (127.0.0.1    (127.0.0.1   (私有云 IP)
                 :3306)        :6379)
```

**公网入口方案**（二选一）：
- **方案 A（推荐）**：frp 内网穿透 — NAS 上运行 frpc，公网 VPS 运行 frps 转发 HTTPS 流量到 NAS API
- **方案 B**：Tailscale/ZeroTier Funnel — 免费 HTTPS 公网入口，无需自备 VPS

---

## 2. 基础设施配置

### 2.1 NAS — MySQL（主业务数据库）

| 配置项 | 说明 |
|--------|------|
| 版本 | MySQL 8.0+ |
| 端口 | 3306 |
| 数据库名 | `goodser` |
| 字符集 | `utf8mb4` / `utf8mb4_unicode_ci` |
| 用户 | `goodser_app`（仅业务操作权限） |
| InnoDB | 默认引擎，支持事务 |
| 连接池 | 20-50 连接（根据 NAS 性能调整） |

### 2.2 NAS — PostgreSQL（可选—分析数据库）

| 配置项 | 说明 |
|--------|------|
| 版本 | PostgreSQL 14+ |
| 端口 | 5432 |
| 数据库名 | `goodser_analytics` |
| 用途 | 复杂统计报表、历史趋势分析、数据导出 |
| 同步策略 | 定时从 MySQL 同步（ETL，非实时） |

> **注意**：PostgreSQL 为可选组件。初期可只用 MySQL，后期如需复杂分析再接入。

### 2.3 NAS — Redis

| 配置项 | 说明 |
|--------|------|
| 版本 | Redis 7.0+ |
| 端口 | 6379 |
| 内存限制 | 128MB-512MB |
| 持久化 | AOF + RDB（每小时快照） |
| 最大连接 | 100 |

### 2.4 私有云 — RustIO

| 配置项 | 说明 |
|--------|------|
| 协议 | S3 兼容 API |
| Bucket | `goodser-images`（商品图片）、`goodser-backups`（数据备份） |
| 访问策略 | 通过 API Server 代理访问，不直接暴露 |
| 图片处理 | 上传前小程序端压缩（≤2MB），RustIO 不额外处理 |

---

## 3. 数据库设计（MySQL）

### 3.1 表结构总览

```
inventories ──┬── products ──┬── product_tags (多对多关联)
              │              ├── seq_counters
              │              └── recycled_seq_numbers
              ├── outbound_orders ── outbound_order_items
              ├── inbound_logs ── inbound_log_items
              └── stock_movements (库存流水)
```

### 3.2 建表 SQL

#### 3.2.1 `inventories` — 库存目录

```sql
CREATE TABLE inventories (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)   NOT NULL COMMENT '目录名称',
    owner_openid  VARCHAR(64)    NOT NULL COMMENT '创建者 openid',
    sort_order    INT            NOT NULL DEFAULT 0 COMMENT '排序权重',
    created_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_owner (owner_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='库存目录';
```

#### 3.2.2 `products` — 商品

```sql
CREATE TABLE products (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_id      BIGINT UNSIGNED NOT NULL COMMENT '所属库存目录 ID',
    code              CHAR(18)        NOT NULL COMMENT '完整编码，如 A-B-0001-0015-A',
    main_zone         CHAR(1)         NOT NULL COMMENT '主分区 A-Z',
    sub_zone          CHAR(1)         NOT NULL COMMENT '子分区 A-Z',
    seq_number        SMALLINT        NOT NULL COMMENT '序号 1-9999',
    quantity          INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '当前库存数量',
    reserved_quantity INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '预留数量',
    status_code       CHAR(1)         NOT NULL COMMENT '状态编码 A-Z',
    name              VARCHAR(200)    NOT NULL COMMENT '商品名称',
    original_price    DECIMAL(10,2)   DEFAULT NULL COMMENT '原价',
    market_price      DECIMAL(10,2)   DEFAULT NULL COMMENT '市场价',
    expected_price    DECIMAL(10,2)   DEFAULT NULL COMMENT '预期出售价',
    remark            TEXT            DEFAULT NULL COMMENT '备注信息',
    storage_location  VARCHAR(200)    DEFAULT NULL COMMENT '仓储位置',
    image_url         VARCHAR(500)    DEFAULT NULL COMMENT '头图 S3 Key',
    image_list        JSON            DEFAULT NULL COMMENT '额外图片 S3 Key 列表',
    owner_openid      VARCHAR(64)     NOT NULL COMMENT '创建者 openid',
    created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE,

    INDEX idx_inventory (inventory_id),
    INDEX idx_zone (inventory_id, main_zone, sub_zone),
    INDEX idx_code (code) USING BTREE,
    INDEX idx_status (status_code),
    FULLTEXT INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='商品';
```

#### 3.2.3 `product_tags` — 商品-标签关联

```sql
CREATE TABLE product_tags (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT UNSIGNED NOT NULL,
    tag_id     BIGINT UNSIGNED NOT NULL,
    UNIQUE KEY uk_product_tag (product_id, tag_id),
    INDEX idx_product (product_id),
    INDEX idx_tag (tag_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='商品标签关联';
```

#### 3.2.4 `seq_counters` — 序号计数器

```sql
CREATE TABLE seq_counters (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_id  BIGINT UNSIGNED NOT NULL,
    main_zone     CHAR(1)         NOT NULL,
    sub_zone      CHAR(1)         NOT NULL,
    current_max   SMALLINT        NOT NULL DEFAULT 0 COMMENT '当前已分配的最大序号',

    UNIQUE KEY uk_zone (inventory_id, main_zone, sub_zone),
    FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='序号计数器';
```

#### 3.2.5 `recycled_seq_numbers` — 序号回收池

```sql
CREATE TABLE recycled_seq_numbers (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_id  BIGINT UNSIGNED NOT NULL,
    main_zone     CHAR(1)         NOT NULL,
    sub_zone      CHAR(1)         NOT NULL,
    seq_number    SMALLINT        NOT NULL COMMENT '被回收的序号',
    recycled_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_zone_seq (inventory_id, main_zone, sub_zone, seq_number),
    FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='序号回收池';
```

#### 3.2.6 `outbound_orders` — 出库单/预留单

```sql
CREATE TABLE outbound_orders (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_id  BIGINT UNSIGNED NOT NULL,
    order_no      VARCHAR(20)     NOT NULL COMMENT '单号: OUT/RSV+YYYYMMDD+序号',
    type          ENUM('outbound','reserve') NOT NULL COMMENT '单据类型',
    status        ENUM('pending','reserved','confirmed','cancelled') NOT NULL DEFAULT 'pending',
    order_info    VARCHAR(500)    DEFAULT NULL COMMENT '订单信息/描述',
    remark        TEXT            DEFAULT NULL COMMENT '备注',
    source_order_id BIGINT UNSIGNED DEFAULT NULL COMMENT '预留单转出库时的来源预留单ID',
    owner_openid  VARCHAR(64)     NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at  DATETIME        DEFAULT NULL,
    cancelled_at  DATETIME        DEFAULT NULL,

    INDEX idx_inventory (inventory_id),
    INDEX idx_inventory_type (inventory_id, type),
    INDEX idx_inventory_status (inventory_id, status),
    INDEX idx_created (created_at),
    UNIQUE KEY uk_order_no (order_no),
    FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='出库单/预留单';
```

#### 3.2.7 `outbound_order_items` — 出库单商品明细

```sql
CREATE TABLE outbound_order_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id        BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    product_name    VARCHAR(200)    NOT NULL COMMENT '操作时快照',
    product_code    CHAR(18)        NOT NULL COMMENT '操作时快照',
    quantity        INT UNSIGNED    NOT NULL COMMENT '出库/预留数量',
    image_url       VARCHAR(500)    DEFAULT NULL,

    FOREIGN KEY (order_id) REFERENCES outbound_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='出库单商品明细';
```

#### 3.2.8 `inbound_logs` — 入库日志

```sql
CREATE TABLE inbound_logs (
    id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    inventory_id  BIGINT UNSIGNED NOT NULL,
    order_no      VARCHAR(20)     NOT NULL COMMENT '单号: IN+YYYYMMDD+序号',
    type          ENUM('single','batch','search') NOT NULL COMMENT '入库类型',
    remark        TEXT            DEFAULT NULL COMMENT '备注',
    owner_openid  VARCHAR(64)     NOT NULL,
    created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_inventory (inventory_id),
    INDEX idx_created (created_at),
    UNIQUE KEY uk_order_no (order_no),
    FOREIGN KEY (inventory_id) REFERENCES inventories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='入库日志';
```

#### 3.2.9 `inbound_log_items` — 入库单商品明细

```sql
CREATE TABLE inbound_log_items (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    log_id          BIGINT UNSIGNED NOT NULL,
    product_id      BIGINT UNSIGNED NOT NULL,
    product_name    VARCHAR(200)    NOT NULL COMMENT '操作时快照',
    product_code    CHAR(18)        NOT NULL COMMENT '操作时快照',
    quantity        INT UNSIGNED    NOT NULL COMMENT '入库数量',
    image_url       VARCHAR(500)    DEFAULT NULL,

    FOREIGN KEY (log_id) REFERENCES inbound_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    INDEX idx_log (log_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='入库单商品明细';
```

#### 3.2.10 `stock_movements` — 库存流水（审计用）

```sql
CREATE TABLE stock_movements (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id      BIGINT UNSIGNED NOT NULL,
    inventory_id    BIGINT UNSIGNED NOT NULL,
    movement_type   ENUM('inbound','outbound','reserve','cancel_reserve','cancel_outbound','edit') NOT NULL,
    quantity_change INT             NOT NULL COMMENT '数量变化(+/-)',
    quantity_after  INT UNSIGNED    NOT NULL COMMENT '操作后库存',
    reference_type  VARCHAR(20)     DEFAULT NULL COMMENT '关联单据类型',
    reference_id    BIGINT UNSIGNED DEFAULT NULL COMMENT '关联单据ID',
    operator_openid VARCHAR(64)     NOT NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_product (product_id),
    INDEX idx_inventory (inventory_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='库存流水';
```

#### 3.2.11 `whitelist` — 访问白名单

```sql
CREATE TABLE whitelist (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    openid     VARCHAR(64)  NOT NULL COMMENT '用户 openid',
    nickname   VARCHAR(100) DEFAULT NULL,
    avatar_url VARCHAR(500) DEFAULT NULL,
    role       ENUM('admin','member') NOT NULL DEFAULT 'member',
    added_by   VARCHAR(64)  DEFAULT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_openid (openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='访问白名单';
```

#### 3.2.12 `status_codes` — 状态编码定义

```sql
CREATE TABLE status_codes (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code       CHAR(1)      NOT NULL COMMENT '状态编码 A-Z',
    label      VARCHAR(50)  NOT NULL COMMENT '状态显示名称',
    is_system  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否系统预设',
    owner_openid VARCHAR(64) NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='状态编码定义';
```

#### 3.2.13 `tags` — 标签

```sql
CREATE TABLE tags (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(50)  NOT NULL COMMENT '标签名称',
    color      CHAR(7)      NOT NULL COMMENT '颜色 HEX，如 #ff4d4f',
    owner_openid VARCHAR(64) NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='标签';
```

### 3.3 序号分配（事务保证）

序号分配是并发敏感操作，MySQL 用事务 + 行锁保证：

```sql
-- 事务内执行
START TRANSACTION;

-- Step 1: 尝试从回收池取最小序号
SELECT seq_number FROM recycled_seq_numbers
WHERE inventory_id = ? AND main_zone = ? AND sub_zone = ?
ORDER BY seq_number ASC LIMIT 1 FOR UPDATE;

-- Step 2: 若有回收序号，删除并返回
DELETE FROM recycled_seq_numbers WHERE id = ?;

-- Step 3: 若无回收序号，从计数器自增
INSERT INTO seq_counters (inventory_id, main_zone, sub_zone, current_max)
VALUES (?, ?, ?, 1)
ON DUPLICATE KEY UPDATE current_max = current_max + 1;

-- Step 4: 读取新序号
SELECT current_max FROM seq_counters
WHERE inventory_id = ? AND main_zone = ? AND sub_zone = ?;

COMMIT;
```

### 3.4 PostgreSQL 侧（可选）

当需要复杂分析时，PostgreSQL 作为 OLAP 侧存储，通过定时 ETL 从 MySQL 同步。
主要用途：

- 库存趋势分析（按周/月/季度聚合）
- 出入库频率统计
- 分区使用热力图
- 自定义报表生成

---

## 4. Redis 缓存设计

### 4.1 缓存 Key 设计

| Key 模式 | 类型 | TTL | 说明 |
|----------|------|-----|------|
| `session:{openid}` | Hash | 7d | 用户会话信息 |
| `product:{product_id}` | Hash | 300s | 商品缓存 |
| `inventory:{id}:stats` | Hash | 60s | 库存目录统计（商品数/总库存） |
| `whitelist:openids` | Set | 永久 | 白名单 openid 集合（快速校验） |
| `tag:counts` | Hash | 300s | 各标签关联商品数 |
| `seq:lock:{inventory_id}:{main}:{sub}` | String | 5s | 序号分配分布式锁 |
| `rate:{openid}:{action}` | String | 60s | API 速率限制计数 |
| `nas:reachable` | String | 30s | NAS 可连接性状态 |

### 4.2 缓存策略

```
读取流程：
  1. 查 Redis 缓存
  2. 命中 → 返回
  3. 未命中 → 查 MySQL → 写入 Redis → 返回
  
写入流程：
  1. 写入 MySQL（事务）
  2. 删除/更新相关 Redis 缓存（Cache-Aside 模式）
  3. 返回

序分号配（分布式锁）：
  1. SET seq:lock:{key} {random} NX EX 5  （获取锁）
  2. 执行序号分配 SQL 事务
  3. DEL seq:lock:{key}  （释放锁，需 Lua 脚本校验随机值）
```

### 4.3 会话管理

```json
// session:{openid}
{
  "openid": "oXXXX",
  "nickname": "张三",
  "avatar_url": "https://...",
  "role": "admin",
  "last_login": "2026-06-09T10:00:00Z"
}
```

登录态通过 JWT Token 传递，Redis 只缓存用户信息供快速读取。

---

## 5. 对象存储设计（RustIO）

### 5.1 Bucket 规划

| Bucket | 用途 | 生命周期 |
|--------|------|----------|
| `goodser-images` | 商品图片（头图 + 额外图片） | 永久 |
| `goodser-backups` | 数据库备份文件 | 30 天自动过期 |

### 5.2 文件组织

```
goodser-images/
├── {inventory_id}/
│   ├── {product_id}/
│   │   ├── main.jpg           ← 头图
│   │   ├── extra_001.jpg      ← 额外图片
│   │   └── extra_002.jpg
│   └── ...
└── ...

goodser-backups/
├── 2026-06-01_goodser.sql.gz
├── 2026-06-08_goodser.sql.gz
└── ...
```

### 5.3 图片上传流程

```
┌──────────┐  ①选择图片+压缩   ┌──────────┐  ② wx.uploadFile   ┌──────────┐
│ 小程序端  │ ────────────────→ │  API 服务 │ ────────────────→ │  RustIO  │
│          │                   │  (NAS)   │  PUT /{key}        │          │
│          │ ←─── ③ 返回URL ── │          │ ←─── 上传成功 ──── │          │
└──────────┘                   └──────────┘                   └──────────┘

注：小程序端也可以直接通过预签名 URL 上传到 RustIO，
避免文件经过 API 服务中转，提高效率。
```

### 5.4 预签名上传（推荐方案）

```javascript
// 小程序端流程
// 1. 请求 API 获取预签名 PUT URL
const { presignedUrl, objectKey } = await request('POST /api/images/presign', {
  content_type: 'image/jpeg',
  product_id: '123'
});

// 2. 直接 PUT 到 RustIO
const result = await wx.uploadFile({
  url: presignedUrl,   // 直接上传到 RustIO
  filePath: tempFilePath,
  name: 'file',
  header: { 'Content-Type': 'image/jpeg' }
});

// 3. 通知 API 上传完成
await request('POST /api/images/confirm', {
  product_id: '123',
  object_key: objectKey
});
```

### 5.5 图片访问策略

- 商品图片：通过 API 生成临时签名 URL 返回给客户端（有效期 1 小时）
- 也可配置 RustIO Bucket 为公开读（仅 `goodser-images`），直接 CDN 加速访问

---

## 6. API 接口设计

### 6.1 基础约定

| 项 | 约定 |
|----|------|
| 协议 | HTTPS |
| Base URL | `https://api.goodser.local`（组网内）或 `https://goodser.yourdomain.com`（公网） |
| 认证 | Header `Authorization: Bearer <JWT>` |
| 请求格式 | `application/json` |
| 响应格式 | `{ "code": 0, "data": ..., "message": "ok" }` |
| 时间格式 | ISO 8601 (`2026-06-09T10:00:00Z`) |

### 6.2 响应规范

```json
// 成功
{ "code": 0, "data": { ... }, "message": "ok" }

// 业务错误
{ "code": 40001, "data": null, "message": "库存不足" }

// 认证错误
{ "code": 40100, "data": null, "message": "未登录或登录已过期" }
```

### 6.3 接口列表

#### 认证模块

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 微信登录（code → openid → JWT） |
| POST | `/api/auth/refresh` | 刷新 Token |
| GET | `/api/auth/profile` | 获取当前用户信息 |

#### 库存目录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inventories` | 获取目录列表 |
| POST | `/api/inventories` | 创建目录 |
| PUT | `/api/inventories/:id` | 更新目录（名称、排序） |
| DELETE | `/api/inventories/:id` | 删除目录（无商品时） |
| GET | `/api/inventories/:id/stats` | 获取目录统计信息 |

#### 商品

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inventories/:id/products` | 商品列表（分页+搜索+筛选+排序） |
| GET | `/api/inventories/:id/products/:pid` | 商品详情 |
| POST | `/api/inventories/:id/products` | 新增商品（单独入库） |
| PUT | `/api/inventories/:id/products/:pid` | 更新商品 |
| DELETE | `/api/inventories/:id/products/:pid` | 删除商品 |
| POST | `/api/inventories/:id/products/search` | 搜索商品（用于搜索导入） |

**商品列表查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | number | 页码，默认 1 |
| `page_size` | number | 每页数量，默认 20 |
| `keyword` | string | 模糊搜索（名称/编号/备注） |
| `main_zone` | string | 主分区筛选 |
| `status_code` | string | 状态筛选 |
| `tag_ids` | string | 标签 ID 筛选（逗号分隔，OR 逻辑） |
| `sort_by` | string | 排序字段：`name`/`code`/`quantity`/`created_at` |
| `sort_order` | string | `asc` / `desc` |

#### 入库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inventories/:id/inbound/single` | 单独商品入库 |
| POST | `/api/inventories/:id/inbound/batch` | 批量入库 |
| POST | `/api/inventories/:id/inbound/search-import` | 搜索导入入库 |
| GET | `/api/inventories/:id/inbound/logs` | 入库记录列表 |
| GET | `/api/inventories/:id/inbound/logs/:log_id` | 入库单详情 |
| PUT | `/api/inventories/:id/inbound/logs/:log_id` | 编辑入库单 |
| DELETE | `/api/inventories/:id/inbound/logs/:log_id` | 删除入库单（回退库存） |

#### 出库

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inventories/:id/outbound/orders` | 创建出库单 |
| POST | `/api/inventories/:id/outbound/reserves` | 创建预留单 |
| GET | `/api/inventories/:id/outbound/orders` | 出库单/预留单列表 |
| GET | `/api/inventories/:id/outbound/orders/:oid` | 出库单/预留单详情 |
| POST | `/api/inventories/:id/outbound/orders/:oid/confirm` | 确认出库 |
| POST | `/api/inventories/:id/outbound/orders/:oid/cancel` | 取消出库（恢复库存） |
| POST | `/api/inventories/:id/outbound/reserves/:rid/cancel` | 取消预留（释放预留库存） |
| POST | `/api/inventories/:id/outbound/reserves/:rid/to-outbound` | 预留转出库 |

#### 图片

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/presign` | 获取上传预签名 URL |
| POST | `/api/images/confirm` | 确认上传完成 |
| GET | `/api/images/:key/url` | 获取图片访问 URL（签名 URL） |

#### 设置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings/whitelist` | 白名单列表 |
| POST | `/api/settings/whitelist` | 添加白名单成员 |
| DELETE | `/api/settings/whitelist/:id` | 移除白名单成员 |
| GET | `/api/settings/status-codes` | 状态编码列表 |
| POST | `/api/settings/status-codes` | 添加自定义状态编码 |
| DELETE | `/api/settings/status-codes/:id` | 删除自定义状态编码 |
| GET | `/api/settings/tags` | 标签列表 |
| POST | `/api/settings/tags` | 创建标签 |
| PUT | `/api/settings/tags/:id` | 更新标签 |
| DELETE | `/api/settings/tags/:id` | 删除标签 |

---

## 7. NAS 端服务部署

### 7.1 技术栈

| 组件 | 技术选型 | 原因 |
|------|---------|------|
| API 框架 | Fastify (Node.js) | 高性能、插件化、TypeScript 友好、低资源占用 |
| ORM | Drizzle ORM / Prisma | 类型安全、MySQL 支持好 |
| 认证 | `jsonwebtoken` + `axios` | JWT 签发与微信 code2session 接口调用 |
| 对象存储 | `@aws-sdk/client-s3` | 兼容 RustIO 的 S3 API |
| Redis | `ioredis` | Node.js 最成熟的 Redis 客户端 |
| 进程管理 | PM2 | 守护进程、自动重启、日志管理 |

### 7.2 部署步骤

```bash
# 1. 克隆项目到 NAS
cd /volume1/docker/goodser-api
git clone <repo-url> .

# 2. 安装依赖
npm install --production

# 3. 配置文件
cp .env.example .env
# 编辑 .env:
#   DATABASE_URL=mysql://user:pass@127.0.0.1:3306/goodser
#   REDIS_URL=redis://127.0.0.1:6379
#   RUSTIO_ENDPOINT=https://rustio.yourprivatecloud.com
#   RUSTIO_ACCESS_KEY=xxx
#   RUSTIO_SECRET_KEY=xxx
#   JWT_SECRET=your-secret-key
#   WECHAT_APPID=wx7eaacca67fca69c0
#   WECHAT_APPSECRET=xxx

# 4. 数据库迁移
npm run db:migrate
npm run db:seed    # 初始化预设状态编码

# 5. 启动服务
pm2 start ecosystem.config.json
pm2 save
pm2 startup
```

### 7.3 NAS 资源评估

| 资源 | 最低 | 推荐 |
|------|------|------|
| CPU | 1 核 | 2 核 |
| 内存（API 服务） | 512MB | 1GB |
| 内存（MySQL） | 512MB | 1GB |
| 内存（Redis） | 128MB | 256MB |
| 磁盘 | 10GB | 50GB+ |

> 以上为 1-5 人团队规模的评估。

---

## 8. 认证与安全

### 8.1 登录流程

```
┌──────────┐   ① wx.login()    ┌──────────┐
│ 小程序端  │ ────────────────→ │ 微信服务器 │
│          │ ←── ② code ───── │          │
│          │                   └──────────┘
│          │   ③ POST /api/auth/login { code }
│          │ ──────────────────────────────→
│          │                              ┌──────────┐
│          │                              │  API     │
│          │                              │  服务    │
│          │                              │          │
│          │  ④ code2session(code)        │          │
│          │  ───────────────────────────→│ 微信API  │
│          │  ←── openid, session_key ─── │          │
│          │                              │          │
│          │  ⑤ 查 whitelist, 生成 JWT    │          │
│          │                              │          │
│          │  ←── ⑥ JWT + user info ──── │          │
└──────────┘                              └──────────┘
```

### 8.2 JWT 结构

```json
// Header
{ "alg": "HS256", "typ": "JWT" }

// Payload
{
  "sub": "oXXXXXX",            // openid
  "role": "admin",
  "iat": 1717920000,
  "exp": 1718006400            // 24h
}
```

### 8.3 安全措施

| 措施 | 说明 |
|------|------|
| JWT 短期有效 | Access Token 24h，Refresh Token 7d |
| API 速率限制 | Redis 计数器，每 openid 每接口每分钟 60 次 |
| 白名单校验中间件 | 所有 API 请求校验 openid 在白名单中 |
| SQL 参数化查询 | ORM 参数绑定，防止 SQL 注入 |
| 请求体大小限制 | JSON ≤ 1MB，文件上传 ≤ 5MB |
| HTTPS 加密传输 | frp 绑定 HTTPS 端口，Let's Encrypt 证书自动续签 |
| 数据库备份加密 | mysqldump 压缩并加密后上传 RustIO |

### 8.4 公网安全

- API 不直接暴露在公网，通过 frp HTTPS 反向代理
- frps 端配置 TLS 证书（Let's Encrypt 自动续签）
- 可选：Cloudflare Tunnel 替代 frp，零端口暴露

---

## 9. 数据迁移与备份

### 9.1 MySQL 备份策略

```bash
# 每日备份脚本（crontab）
0 3 * * * /volume1/scripts/backup-goodser.sh

# backup-goodser.sh
#!/bin/bash
DATE=$(date +%Y-%m-%d)
mysqldump -u goodser_app -p'***' goodser \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pass pass:$BACKUP_KEY \
  > /tmp/goodser_$DATE.sql.gz.enc

# 上传到 RustIO
aws s3 cp /tmp/goodser_$DATE.sql.gz.enc \
  s3://goodser-backups/ \
  --endpoint-url https://rustio.yourprivatecloud.com

# 删除 30 天前的本地备份
find /tmp -name "goodser_*.sql.gz.enc" -mtime +30 -delete
```

### 9.2 从 Mock 数据迁移

现有小程序使用 `mock-data.js` 内存数据，迁移到 NAS 后端时：

1. 导出 mock-data.js 中的数据为 JSON
2. 编写迁移脚本，将 JSON 转换为 MySQL INSERT 语句
3. 运行时序：先迁移 inventories → products → tags → outbound_orders → inbound_logs
4. 根据现有 products 数据初始化 `seq_counters` 表
5. 清理 mock-data.js 中的 `openid` 占位值

### 9.3 灾难恢复

- RPO（恢复点目标）：≤ 24h（每日备份）
- RTO（恢复时间目标）：≤ 2h
- 恢复流程：还原 MySQL 备份 → 重新初始化 Redis 缓存 → 重启 API 服务

---

> **文档结束** — 本文档随 NAS + 私有云部署实践持续更新。
