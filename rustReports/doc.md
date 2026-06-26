# Goodser Backend 技术文档

## 项目概述

Goodser Backend 是一个基于 Rust 的库存管理系统后端 API 服务，为微信小程序提供 RESTful 接口。采用 Axum Web 框架、MySQL 数据库和 S3 兼容对象存储（RustFS）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| Web 框架 | Axum 0.7 |
| 异步运行时 | Tokio |
| 数据库 | MySQL 8.0 via sqlx 0.7 |
| 对象存储 | RustFS（S3 兼容）via aws-sdk-s3 |
| 序列化 | serde + serde_json |
| 日志 | tracing + tracing-subscriber |
| 错误处理 | thiserror + anyhow |
| 配置管理 | dotenvy |

---

## 项目结构

```
backend/
├── Cargo.toml                 # 项目配置与依赖声明
├── Dockerfile                 # Docker 镜像构建
├── Makefile                   # 常用命令快捷方式
├── .env                       # 环境变量配置
├── sql/
│   └── init.sql               # Docker MySQL 初始化脚本
├── src/
│   ├── main.rs                # 入口：路由定义、服务启动
│   ├── config.rs              # 应用配置（环境变量读取）
│   ├── error.rs               # 统一错误类型定义
│   ├── models/                # 数据模型
│   │   ├── mod.rs             # ApiListResponse<T> 通用分页响应
│   │   ├── inventory.rs       # 库存目录模型
│   │   ├── product.rs         # 产品模型
│   │   ├── order.rs           # 出库单模型（出库/预留）
│   │   ├── inbound_log.rs     # 入库日志模型
│   │   ├── tag.rs             # 标签模型
│   │   ├── status_code.rs     # 状态码模型
│   │   └── whitelist.rs       # 白名单模型
│   ├── db/                    # 数据库访问层
│   │   ├── mod.rs
│   │   └── mysql.rs           # MysqlRepository：所有 SQL 查询与迁移
│   ├── handlers/              # API 处理函数
│   │   ├── mod.rs             # ApiResponse<T>、ApiMessage 等通用类型
│   │   ├── health.rs          # 健康检查接口
│   │   ├── inventory.rs       # 库存 CRUD
│   │   ├── product.rs         # 产品 CRUD、分页查询
│   │   ├── order.rs           # 出库/预留操作
│   │   ├── inbound.rs         # 入库操作（单品/批量/搜索导入）
│   │   ├── image.rs           # 图片上传与管理
│   │   ├── tag.rs             # 标签 CRUD
│   │   ├── status_code.rs     # 状态码 CRUD
│   │   └── whitelist.rs       # 白名单管理
│   ├── middleware/             # HTTP 中间件
│   │   └── mod.rs             # 请求 ID 注入、Bearer Token 认证
│   └── storage/               # 对象存储抽象层
│       ├── mod.rs             # ImageStorage trait
│       └── rustfs.rs          # RustFS（S3）实现
└── tests/
    └── integration_test.rs    # 集成测试
```

---

## 环境变量

| 变量 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `APP_HOST` | 否 | `0.0.0.0` | 服务监听地址 |
| `APP_PORT` | 否 | `8080` | 服务端口 |
| `DATABASE_URL` | **是** | — | MySQL 连接串，格式：`mysql://user:pass@host:port/db` |
| `API_KEY` | 否 | `dev-api-key-change-me` | Bearer Token 认证密钥 |
| `RUSTFS_ENDPOINT` | 否 | `http://localhost:9000` | S3 兼容存储端点 |
| `RUSTFS_REGION` | 否 | `us-east-1` | S3 区域 |
| `RUSTFS_ACCESS_KEY` | **是** | — | S3 Access Key |
| `RUSTFS_SECRET_KEY` | **是** | — | S3 Secret Key |
| `RUSTFS_BUCKET` | 否 | `2313391` | S3 存储桶名称 |
| `RUSTFS_PUBLIC_URL` | 否 | — | 图片公开访问 URL 基础地址 |
| `UPLOAD_DIR` | 否 | `/data/uploads` | 本地上传缓存目录 |
| `RUST_LOG` | 否 | — | 日志级别过滤（如 `info`、`debug`） |

在项目根目录创建 `.env` 文件配置上述变量。

---

## 编译与运行

### 方式一：Docker Compose（推荐）

```bash
# 在项目根目录执行
cp .env.example .env          # 复制并编辑环境变量
docker compose up -d           # 启动所有服务（MySQL + Backend）
docker compose logs -f backend # 查看后端日志
```

后端容器启动后会自动监听源码变化（inotifywait），实现热重载开发。

### 方式二：本地编译运行

```bash
cd backend

# 编译
cargo build

# 运行（需要 DATABASE_URL 和 S3 凭证）
cargo run

# 运行测试
cargo test
```

### 方式三：Makefile 快捷命令

```bash
make base    # 构建基础 Docker 镜像（首次执行）
make build   # 构建后端镜像
make up      # 启动所有服务
make down    # 停止所有服务
make logs    # 查看后端日志
make setup   # 完整初始化：base + build + up
```

---

## 依赖说明

### 核心依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `axum` | 0.7 | Web 框架，处理路由、请求解析、 multipart 上传 |
| `tokio` | 1 | 异步运行时，管理并发任务 |
| `tower` | 0.5 | 服务抽象层，支持中间件组合 |
| `tower-http` | 0.5 | HTTP 中间件（CORS、请求追踪） |
| `sqlx` | 0.7 | 异步 MySQL 驱动，支持编译时 SQL 检查 |
| `serde` / `serde_json` | 1 | 数据序列化/反序列化 |
| `aws-sdk-s3` | 1 | S3 兼容对象存储客户端 |
| `aws-config` | 1 | AWS SDK 配置管理 |
| `tracing` / `tracing-subscriber` | 0.1 / 0.3 | 结构化日志输出与过滤 |
| `thiserror` | 1 | 派生宏，定义结构化错误类型 |
| `anyhow` | 1 | 灵活错误处理 |
| `dotenvy` | 0.15 | 加载 `.env` 配置文件 |
| `chrono` | 0.4 | 日期时间处理 |
| `uuid` | 1 | UUID v4 生成，用作主键 |
| `reqwest` | 0.12 | HTTP 客户端，用于文件上传 |

### 开发依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `tower-test` | 0.4 | Tower 服务测试工具 |

---

## 数据库设计

共 9 张表，存储在 `goodser` 数据库中：

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `inventories` | 库存目录 | id, name, owner_openid, sort_order |
| `products` | 产品 | id, inventory_id, code, main_zone, sub_zone, seq_number, quantity, reserved_quantity, status_code, name, prices, image_url, image_list(JSON), tags(JSON) |
| `outbound_orders` | 出库/预留单 | id, inventory_id, order_no, type(outbound/reserve), status, items(JSON), source_reserve_id |
| `inbound_logs` | 入库日志 | id, inventory_id, order_no, type(single/batch/search), items(JSON) |
| `tags` | 标签 | id, name, color, owner_openid |
| `status_codes` | 状态码 | id, code(CHAR 1), label, is_system, owner_openid |
| `whitelist` | 用户白名单 | id, openid(unique), nickname, avatar_url, role(admin/member), added_by |
| `recycled_seq_numbers` | 回收的序列号 | id, inventory_id, main_zone, sub_zone, seq_number |
| `seq_counters` | 序列号计数器 | id, inventory_id, main_zone, sub_zone, current_max |

预置数据：7 个状态码（A=正常, B=预留, C=已拆, D=损坏, E=过期, F=禁用, N=全新）和 6 个标签（热销、新品、清仓、预售、数码、配件）。

---

## API 接口

### 健康检查

| 方法 | 路径 | 认证 |
|------|------|------|
| POST | `/health` | 否 |

### Legacy 接口（兼容旧版小程序）

所有 Legacy 接口均为 POST 方法，路径格式为 `/api/{操作名}`，如：
- `/api/loadInventories`、`/api/createProduct`、`/api/inboundSingle`
- `/api/createOutbound`、`/api/confirmOutbound`、`/api/cancelReserve`
- `/api/uploadImage`、`/api/checkWhitelist` 等

### RESTful 接口

#### 库存管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inventories` | 获取所有库存 |
| POST | `/api/inventories` | 创建库存 |
| PUT | `/api/inventories/{id}` | 更新库存 |
| DELETE | `/api/inventories/{id}` | 删除库存 |
| GET | `/api/inventories/{id}/stats` | 库存统计 |

#### 产品管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inventories/{id}/products` | 获取库存下产品列表 |
| POST | `/api/inventories/{id}/products` | 创建产品 |
| GET | `/api/inventories/{id}/products/{pid}` | 获取单个产品 |
| PUT | `/api/inventories/{id}/products/{pid}` | 更新产品 |
| DELETE | `/api/inventories/{id}/products/{pid}` | 删除产品 |
| POST | `/api/inventories/{id}/products/search` | 搜索/筛选产品（支持分页、排序、关键词、状态、库位、标签过滤） |

#### 入库管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inventories/{id}/inbound/single` | 单品入库 |
| POST | `/api/inventories/{id}/inbound/batch` | 批量入库 |
| POST | `/api/inventories/{id}/inbound/search-import` | 搜索导入入库 |
| GET | `/api/inventories/{id}/inbound/logs` | 获取入库日志 |
| GET | `/api/inventories/{id}/inbound/logs/{log_id}` | 获取入库日志详情 |
| PUT | `/api/inventories/{id}/inbound/logs/{log_id}` | 更新入库日志 |
| DELETE | `/api/inventories/{id}/inbound/logs/{log_id}` | 删除入库日志 |

#### 出库管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/inventories/{id}/outbound/orders` | 获取出库单列表 |
| POST | `/api/inventories/{id}/outbound/orders` | 创建出库单 |
| GET | `/api/inventories/{id}/outbound/orders/{oid}` | 获取出库单详情 |
| POST | `/api/inventories/{id}/outbound/orders/{oid}/confirm` | 确认出库 |
| POST | `/api/inventories/{id}/outbound/orders/{oid}/cancel` | 取消出库 |
| POST | `/api/inventories/{id}/outbound/reserves` | 创建预留单 |
| POST | `/api/inventories/{id}/outbound/reserves/{rid}/cancel` | 取消预留 |
| POST | `/api/inventories/{id}/outbound/reserves/{rid}/to-outbound` | 预留转出库 |

#### 图片管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/images/presign` | 获取预签名上传 URL |
| POST | `/api/images/confirm` | 确认上传完成 |
| GET | `/api/images/{key}/url` | 获取图片公开 URL |

#### 设置管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST/DELETE | `/api/settings/whitelist` | 白名单管理 |
| GET/POST/DELETE | `/api/settings/status-codes` | 状态码管理 |
| GET/POST/PUT/DELETE | `/api/settings/tags` | 标签管理 |

---

## 核心业务逻辑

1. **库存管理**：层级式库存目录，支持增删改查。库存下有产品时不可删除。

2. **产品管理**：产品归属于库存，通过库位编码体系（`主库位-子库位-序号_数量-状态`）标识。支持名称全文搜索、按状态/库位/标签筛选、分页排序查询。

3. **序列号分配**：基于库位的序列号管理，支持回收复用。产品删除时序列号进入回收池，新分配优先从回收池取号，否则递增计数器。

4. **入库操作**：三种模式 — 单品入库、批量入库、搜索导入（对已有产品增加数量）。所有操作创建入库日志。

5. **出库操作**：支持出库（扣减数量）和预留（增加预留数量）。订单状态流转：待处理 → 已确认/已取消。预留单可转换为出库单。

6. **图片存储**：通过 RustFS（S3 兼容）管理图片，支持直传、预签名 URL 上传和存在性校验。

7. **访问控制**：基于白名单的微信用户权限管理，支持管理员/成员角色，防止移除最后一个管理员。

---

## 代码质量工具

### 代码格式化

```bash
# 在运行中的容器内执行
docker compose exec backend cargo fmt

# 本地执行
cargo fmt
```

### 代码静态分析

```bash
# 在运行中的容器内执行
docker compose exec backend cargo clippy -- -D warnings

# 本地执行
cargo clippy -- -D warnings
```

---

## 项目统计

- Rust 源文件数：20 个，分布在 7 个模块中
- 代码量：约 3,500+ 行（数据库层约 1,200 行）
- 测试覆盖：每个模块均有单元测试，另有集成测试文件 `tests/integration_test.rs`
- 数据库迁移：嵌入在 `mysql.rs` 中（11 条迁移语句 + 2 条种子数据插入）
