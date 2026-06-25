# Goodser Backend 改进清单

## 一、作业目标改进

### 1.1 Rust 基础语法与类型系统
- [ ] 实现 `FromStr` trait（替代自定义 `from_str` 方法）
- [ ] 实现 `Display` trait（用于枚举和错误类型）
- [ ] 实现 `TryFrom` trait（类型安全转换）

### 1.2 所有权、借用
- [ ] 减少 `src/db/mysql.rs` 中的 `.clone()` 调用
- [ ] 优化 `CreateOutboundRequest` 等结构体的借用方式

### 1.3 模块化设计
- [x] 7个模块已清晰分离
- [ ] 考虑使用 workspace 管理（如需拆分）

### 1.4 错误处理
- [x] `AppError` + `?` 操作符已正确使用
- [x] `unwrap_or`、`unwrap_or_default` 使用合理

### 1.5 工程化开发流程
- [ ] 完善 Makefile（增加 fmt、clippy、test 命令）
- [ ] 添加 CI 配置（GitHub Actions）

### 1.6 文档与测试
- [x] 增加 handlers 模块单元测试
- [ ] 增加 db 模块 Mock 测试
- [x] 补充 README 架构图

---

## 二、项目选题要求改进

### 2.1 Rust 核心特性体现
- [ ] 增加 `impl From<&str> for OrderType` 
- [ ] 增加 `impl Into<String> for OrderStatus`
- [ ] 增加泛型函数示例

### 2.2 项目复杂度
- [x] 已达标的模块数量（7个）
- [x] 已达标的 API 数量（30+）

---

## 三、技术要求改进

### 3.1 模块化设计（5.1.1）
- [x] 使用 `mod` 组织代码
- [ ] 考虑使用 `pub use` 简化导出

### 3.2 错误处理（5.1.2）
- [x] 使用 `Result` 返回错误
- [x] 使用 `?` 传播错误
- [x] 避免大量 `unwrap/expect`

### 3.3 Rust 核心特性（5.1.3）
- [x] ownership/borrowing：函数签名使用引用
- [x] struct/enum：9个业务struct + 3个enum
- [x] trait：`ImageStorage` trait 抽象
- [x] 泛型：`ApiResponse<T>`、`ApiListResponse<T>`
- [x] 生命周期：中间件 `&'static str`
- [ ] **改进**：增加更多 trait 实现

### 3.4 并发或异步（5.1.4）
- [x] 使用 tokio + Axum 全异步
- [x] 使用 sqlx 异步数据库
- [x] 使用 `Arc<dyn ImageStorage>` 共享状态

### 3.5 测试（5.1.5）
- [x] config.rs：5个单元测试
- [x] error.rs：7个单元测试
- [x] middleware/mod.rs：4个单元测试
- [x] handlers/mod.rs：4个单元测试
- [x] handlers/inventory.rs：4个单元测试
- [x] handlers/health.rs：2个单元测试
- [x] handlers/product.rs：12个单元测试（含验证逻辑测试）
- [x] handlers/order.rs：11个单元测试（含边界情况测试）
- [x] handlers/tag.rs：7个单元测试
- [x] handlers/whitelist.rs：8个单元测试
- [x] handlers/status_code.rs：8个单元测试
- [x] handlers/inbound.rs：9个单元测试
- [x] handlers/image.rs：8个单元测试
- [x] models/*：多个单元测试
- [x] storage/rustfs.rs：5个单元测试
- [x] integration_test.rs：14个单元测试 + 12个E2E测试

### 3.6 工程规范（5.1.6）
- [ ] 运行 `cargo fmt` 格式化
- [ ] 运行 `cargo clippy` 检查警告
- [ ] 移除不必要的 `#[allow(dead_code)]`

### 3.7 项目文档（5.1.7）
- [x] 使用方法
- [x] 编译运行方式
- [x] 依赖说明
- [x] 系统架构图（Mermaid）
- [x] 数据库 ER 图
- [x] 请求处理流程图

---

## 四、创新性与实用性（5%）

### 4.1 已有创新点
- [x] 序号回收再利用机制
- [x] 依赖注入解决测试线程安全
- [x] Trait 抽象存储接口

### 4.2 可补充说明
- [ ] 与传统方案的对比分析
- [ ] 性能优势说明

---

## 五、优先级排序

| 优先级 | 任务 | 预期提升 | 状态 |
|--------|------|---------|------|
| 🔴 高 | 增加 handlers 单元测试 | 功能完整性 +5分 | ✅ 完成 |
| 🔴 高 | 补充 README 架构图 | 文档完整性 +3分 | ✅ 完成 |
| 🟡 中 | 增加 FromStr/Display/Trait | Rust特性 +3分 | 待办 |
| 🟡 中 | 减少 .clone() | 代码质量 +2分 | 待办 |
| 🟢 低 | 完善 Makefile/CI | 工程规范 +2分 | 待办 |

---

## 六、进度记录

| 日期 | 完成项 | 备注 |
|------|--------|------|
| 2026-06-25 | 创建 Todo.md | 初始改进清单 |
| 2026-06-25 | 增加 handlers 单元测试 | product/order/tag/whitelist/status_code/inbound/image |
| 2026-06-25 | 补充 README 架构图 | 系统架构图、ER图、请求流程图 |
