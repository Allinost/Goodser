# Goodser 微信云开发版后端设计文档

> 版本：v1.0
> 日期：2026-06-09
> 适用范围：基于微信云开发（CloudBase）的 Serverless 后端

---

## 目录

1. [总体架构](#1-总体架构)
2. [云开发环境配置](#2-云开发环境配置)
3. [云数据库设计](#3-云数据库设计)
4. [云函数设计](#4-云函数设计)
5. [云存储设计](#5-云存储设计)
6. [API 接口设计（云函数调用）](#6-api-接口设计云函数调用)
7. [认证与权限](#7-认证与权限)
8. [安全规则设计](#8-安全规则设计)
9. [开发调试与部署](#9-开发调试与部署)
10. [成本评估](#10-成本评估)

---

## 1. 总体架构

```
┌───────────────────────────────────────────────────────┐
│                      微信小程序                         │
│                  (Goodser 前端)                         │
│         wx.cloud.callFunction() / wx.cloud.database()   │
└──────────┬──────────────────────────────┬──────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌──────────────────────────┐
│     云函数 (Node.js)  │    │     云数据库 (NoSQL)       │
│                      │◄──►│   - inventories           │
│  ├── product/        │    │   - products              │
│  ├── outbound/       │    │   - outbound_orders       │
│  ├── inbound/        │    │   - inbound_logs          │
│  ├── inventory/      │    │   - whitelist             │
│  ├── settings/       │    │   - status_codes          │
│  ├── nas-sync/       │    │   - tags                  │
│  └── image/          │    │   - ...                   │
└──────────┬───────────┘    └──────────────────────────┘
           │
           ▼
┌──────────────────────┐    ┌──────────────────────────┐
│     云存储 (COS)      │    │     NAS (可选混合方案)      │
│   - 商品图片          │    │     - 图片持久化存储        │
│   - CDN 加速         │    │     - 长期备份              │
└──────────────────────┘    └──────────────────────────┘
```

### 1.1 核心优势

| 优势 | 说明 |
|------|------|
| 零服务器运维 | 无需管理服务器、数据库、Redis |
| 免鉴权 | 微信原生集成，`wx.cloud.callFunction()` 自动携带 openid |
| 弹性伸缩 | 按量付费，低流量时几乎免费 |
| CDN 加速 | 云存储自动 CDN，图片加载快 |
| 一站式 | 数据库 + 存储 + 函数 在同一控制台管理 |

### 1.2 云开发选型

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **基础模式** | 云数据库（文档型）+ 云函数 + 云存储 | 个人/小团队起步，本项目推荐 |
| **MySQL 模式** | CloudBase MySQL（关系型数据库） | 后期数据量大、复杂查询时迁移 |

> **本项目采用基础模式**：文档型数据库灵活、开发快、零成本起步。

---

## 2. 云开发环境配置

### 2.1 环境初始化

```javascript
// miniprogram/app.js
App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'goodser-1a2b3c',      // 云环境 ID
      traceUser: true              // 追踪用户访问
    });
  }
});
```

### 2.2 环境参数

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 环境 ID | `goodser-1a2b3c` | 在云开发控制台创建 |
| 环境名称 | Goodser | — |
| 套餐 | 基础版（免费额度） | 可按需升级 |
| Node.js 版本 | 16.13+ / 18.x | 云函数运行时 |

### 2.3 免费额度

| 资源 | 免费额度 / 月 |
|------|--------------|
| 云函数调用次数 | 100 万次 |
| 云函数资源使用量 | 4 万 GBs |
| 云数据库读次数 | 5 万次 |
| 云数据库写次数 | 3 万次 |
| 云数据库容量 | 2 GB |
| 云存储容量 | 5 GB |
| 云存储下载流量 | 5 GB/月 |

> 1-5 人团队的库存管理小程服务充足够用。

---

## 3. 云数据库设计

### 3.1 集合（Collection）总览

| 集合名 | 说明 | 数据类型 |
|--------|------|----------|
| `inventories` | 库存目录 | 文档 |
| `products` | 商品 | 文档 |
| `recycled_seq_numbers` | 序号回收池 | 文档 |
| `seq_counters` | 序号计数器 | 文档 |
| `outbound_orders` | 出库单/预留单 | 文档（含子文档 items） |
| `inbound_logs` | 入库日志 | 文档（含子文档 items） |
| `whitelist` | 访问白名单 | 文档 |
| `status_codes` | 状态编码定义 | 文档 |
| `tags` | 标签 | 文档 |

### 3.2 文档结构定义

#### 3.2.1 `inventories` — 库存目录

```json
{
  "_id": "auto_generated",
  "name": "默认仓库",
  "owner_openid": "oXXXXXXX",
  "sort_order": 0,
  "created_at": "2026-06-09T10:00:00Z",
  "updated_at": "2026-06-09T10:00:00Z"
}
```

**索引**：
- `owner_openid`（普通索引）
- `created_at`（普通索引）

**数据库权限**：仅创建者可读写

#### 3.2.2 `products` — 商品

```json
{
  "_id": "auto_generated",
  "inventory_id": "inventory_doc_id",
  "code": "A-B-0001-0015-A",
  "main_zone": "A",
  "sub_zone": "B",
  "seq_number": 1,
  "quantity": 15,
  "reserved_quantity": 3,
  "status_code": "A",
  "name": "商品名称",
  "original_price": 100.00,
  "market_price": 120.00,
  "expected_price": 110.00,
  "remark": "备注信息",
  "storage_location": "A区-1架-3层",
  "image_url": "cloud://goodser-xxx.6765-goodser-xxx/images/xxx/main.jpg",
  "image_list": ["cloud://...extra_001.jpg"],
  "nas_image_url": null,
  "tags": ["tag_id_1", "tag_id_2"],
  "owner_openid": "oXXXXXXX",
  "created_at": "2026-06-09T10:00:00Z",
  "updated_at": "2026-06-09T14:20:00Z"
}
```

**索引**：
- `inventory_id`（普通索引）
- `inventory_id, main_zone, sub_zone`（复合索引）
- `code`（普通索引）
- `status_code`（普通索引）
- `tags`（数组索引）
- `name`（文本索引 — 用于模糊搜索）

**数据库权限**：仅创建者可读写

#### 3.2.3 `recycled_seq_numbers` — 序号回收池

```json
{
  "_id": "auto_generated",
  "inventory_id": "inventory_doc_id",
  "main_zone": "A",
  "sub_zone": "B",
  "seq_number": 2,
  "recycled_at": "2026-06-09T10:30:00Z"
}
```

**索引**：
- `inventory_id, main_zone, sub_zone, seq_number`（复合索引）

**数据库权限**：仅创建者可读写

#### 3.2.4 `seq_counters` — 序号计数器

```json
{
  "_id": "auto_generated",
  "inventory_id": "inventory_doc_id",
  "main_zone": "A",
  "sub_zone": "B",
  "current_max": 15
}
```

**索引**：
- `inventory_id, main_zone, sub_zone`（复合唯一索引）

**数据库权限**：仅创建者可读写

#### 3.2.5 `outbound_orders` — 出库单/预留单

```json
{
  "_id": "auto_generated",
  "inventory_id": "inventory_doc_id",
  "order_no": "OUT20260609001",
  "type": "outbound",
  "status": "pending",
  "order_info": "客户订单 #1234",
  "remark": "备注信息",
  "source_reserve_id": "reserve_doc_id",
  "items": [
    {
      "product_id": "product_doc_id_1",
      "product_name": "商品A",
      "product_code": "A-B-0001-0015-A",
      "quantity": 5,
      "image_url": "cloud://..."
    }
  ],
  "owner_openid": "oXXXXXXX",
  "created_at": "2026-06-09T10:00:00Z",
  "updated_at": "2026-06-09T10:00:00Z",
  "confirmed_at": null,
  "cancelled_at": null
}
```

**索引**：
- `inventory_id`（普通索引）
- `inventory_id, type`（复合索引）
- `inventory_id, status`（复合索引）
- `order_no`（唯一索引）
- `owner_openid`（普通索引）

**数据库权限**：仅创建者可读写

> **子文档 vs 独立集合**：`items` 采用嵌入式子文档而非独立集合，因为出库单读取时通常需要一次获取所有商品明细，嵌入可减少查询次数。

#### 3.2.6 `inbound_logs` — 入库日志

```json
{
  "_id": "auto_generated",
  "inventory_id": "inventory_doc_id",
  "order_no": "IN20260609001",
  "type": "single",
  "remark": "备注信息",
  "items": [
    {
      "product_id": "product_doc_id_1",
      "product_name": "商品A",
      "product_code": "A-B-0001-0015-A",
      "quantity": 10,
      "image_url": "cloud://..."
    }
  ],
  "owner_openid": "oXXXXXXX",
  "created_at": "2026-06-09T10:00:00Z"
}
```

**索引**：
- `inventory_id`（普通索引）
- `owner_openid`（普通索引）
- `created_at`（普通索引）

**数据库权限**：仅创建者可读写

#### 3.2.7 `whitelist` — 访问白名单

```json
{
  "_id": "auto_generated",
  "openid": "oXXXXXXX",
  "nickname": "张三",
  "avatar_url": "https://thirdwx.qlogo.cn/xxx",
  "role": "admin",
  "added_by": "oYYYYYYY",
  "created_at": "2026-06-09T10:00:00Z"
}
```

**索引**：
- `openid`（唯一索引）

**数据库权限**：所有用户可读（用于登录校验），仅管理员可写

#### 3.2.8 `status_codes` — 状态编码定义

```json
{
  "_id": "auto_generated",
  "code": "A",
  "label": "自留",
  "is_system": true,
  "owner_openid": "oXXXXXXX",
  "created_at": "2026-06-09T10:00:00Z"
}
```

**索引**：
- `code`（唯一索引）

**数据库权限**：所有用户可读，仅创建者可写

#### 3.2.9 `tags` — 标签

```json
{
  "_id": "auto_generated",
  "name": "热销",
  "color": "#ff4d4f",
  "owner_openid": "oXXXXXXX",
  "created_at": "2026-06-09T10:00:00Z"
}
```

**索引**：
- `name`（唯一索引）

**数据库权限**：所有用户可读，仅创建者可写/删

### 3.3 预设数据（种子数据）

首次使用需通过云函数初始化以下预设数据：

```javascript
// 状态编码预设
const PRESET_STATUS_CODES = [
  { code: 'A', label: '自留', is_system: true },
  { code: 'B', label: '预留', is_system: true },
  { code: 'C', label: '已拆', is_system: true },
  { code: 'D', label: '损坏', is_system: true },
  { code: 'E', label: '过期', is_system: true },
  { code: 'F', label: '停用', is_system: true },
  { code: 'N', label: '全新', is_system: true }
];

// 预设仓库
const DEFAULT_INVENTORY = {
  name: '默认仓库',
  sort_order: 0
};
```

### 3.4 当前 Mock 数据路径总结

| 设计文档集合 | 当前 mock-data.js 数组 | 当前前端引用方式 |
|-------------|----------------------|-----------------|
| inventories | `inventories[]` | mockData.getInventories() |
| products | `products[]` | mockData.getProducts() |
| outbound_orders | `outboundOrders[]` | mockData.getOutboundOrders() |
| inbound_logs | `inboundLogs[]` | mockData.getInboundLogs() |
| whitelist | `whitelist[]` | mockData.getWhitelist() |
| status_codes | `statusCodes[]` | mockData.getStatusCodes() |
| tags | `tags[]` | mockData.getTags() |

> **迁移路径**：将 `mock-data.js` 中的每个函数替换为 `wx.cloud.database().collection(...)` 调用，通过云开发中间件（db.js）统一封装。

---

## 4. 云函数设计

### 4.1 云函数目录

```
cloudfunctions/
├── auth/
│   ├── index.js          # 登录、获取用户信息
│   └── package.json
├── inventory/
│   ├── index.js          # 库存目录 CRUD、统计
│   └── package.json
├── product/
│   ├── index.js          # 商品 CRUD、搜索、排序、筛选、分页
│   └── package.json
├── inbound/
│   ├── index.js          # 入库操作（单独/批量/搜索导入）
│   └── package.json
├── outbound/
│   ├── index.js          # 出库/预留创建、确认、取消
│   └── package.json
├── settings/
│   ├── index.js          # 白名单/状态编码/标签管理
│   └── package.json
├── image/
│   ├── index.js          # 图片上传/URL获取
│   └── package.json
├── nas-sync/
│   ├── index.js          # NAS 异步同步（定时触发器）
│   └── package.json
└── init/
    ├── index.js          # 项目初始化（预设数据、首个管理员）
    └── package.json
```

### 4.2 云函数入口模式（路由分发）

使用请求参数 `action` 字段分发到不同处理函数：

```javascript
// cloudfunctions/product/index.js
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action } = event;
  const { OPENID } = cloud.getWXContext();

  // 白名单校验
  const whitelist = await db.collection('whitelist')
    .where({ openid: OPENID }).get();
  if (whitelist.data.length === 0) {
    return { code: 40300, message: '无访问权限' };
  }

  const actions = {
    list:    require('./actions/list'),
    detail:  require('./actions/detail'),
    create:  require('./actions/create'),
    update:  require('./actions/update'),
    remove:  require('./actions/remove'),
    search:  require('./actions/search'),
    stats:   require('./actions/stats')
  };

  if (!actions[action]) {
    return { code: 40000, message: `无效的操作: ${action}` };
  }

  return actions[action](event, { db, _, OPENID });
};
```

### 4.3 云函数职责矩阵

| 云函数 | action | 职责 |
|--------|--------|------|
| **auth** | `login` | 微信 code 换取 openid，写入/验证白名单 |
| | `profile` | 获取当前用户信息和角色 |
| **inventory** | `list` | 获取库存目录列表 |
| | `create` | 创建库存目录 |
| | `update` | 重命名/调整排序 |
| | `remove` | 删除目录（校验无商品） |
| | `stats` | 获取目录统计（商品数/总库存） |
| **product** | `list` | 商品列表（分页+搜索+筛选+排序） |
| | `detail` | 商品详情（含标签信息 JOIN） |
| | `create` | 新增商品（含编码生成） |
| | `update` | 更新商品（含编码重生成） |
| | `remove` | 删除商品（回收序号，校验出库单关联） |
| | `search` | 快速搜索（用于搜索导入） |
| **inbound** | `single` | 单独商品入库 |
| | `batch` | 批量入库 |
| | `searchImport` | 搜索已有商品并增加库存 |
| | `logs` | 入库记录列表 |
| | `logDetail` | 入库单详情 |
| | `logUpdate` | 编辑入库单 |
| | `logRemove` | 删除入库单（回退库存） |
| **outbound** | `createOrder` | 创建出库单（库存校验+扣减） |
| | `createReserve` | 创建预留单（锁定库存） |
| | `orders` | 出库单/预留单列表 |
| | `orderDetail` | 出库单/预留单详情 |
| | `confirm` | 确认出库（状态变更） |
| | `cancel` | 取消出库（恢复库存） |
| | `cancelReserve` | 取消预留（释放预留库存） |
| | `reserveToOutbound` | 预留转出库（生成新出库单） |
| **settings** | `whitelist/list` | 白名单列表 |
| | `whitelist/add` | 添加成员 |
| | `whitelist/remove` | 移除成员 |
| | `statusCodes/list` | 状态编码列表 |
| | `statusCodes/add` | 添加自定义状态编码 |
| | `statusCodes/remove` | 删除自定义状态编码 |
| | `tags/list` | 标签列表（含关联商品计数） |
| | `tags/create` | 创建标签 |
| | `tags/update` | 更新标签（名称/颜色） |
| | `tags/remove` | 删除标签（校验无商品关联） |
| **image** | `upload` | 获取云存储上传配置 |
| | `getUrl` | 获取图片临时访问 URL |
| | `remove` | 删除云存储图片文件 |
| **nas-sync** | `syncImages` | 云存储图片同步到 NAS（定时触发） |
| **init** | `setup` | 初始化预设数据和首个管理员 |

### 4.4 关键业务逻辑示例

#### 序号分配（云函数内）

```javascript
// 在 product/create 中
async function allocateSeqNumber(db, _, inventoryId, mainZone, subZone) {
  // 1. 查回收池最小序号
  const recycled = await db.collection('recycled_seq_numbers')
    .where({ inventory_id: inventoryId, main_zone: mainZone, sub_zone: subZone })
    .orderBy('seq_number', 'asc')
    .limit(1)
    .get();

  if (recycled.data.length > 0) {
    const seq = recycled.data[0];
    await db.collection('recycled_seq_numbers').doc(seq._id).remove();
    return seq.seq_number;
  }

  // 2. 自增计数器
  const counter = await db.collection('seq_counters')
    .where({ inventory_id: inventoryId, main_zone: mainZone, sub_zone: subZone })
    .get();

  if (counter.data.length > 0) {
    const newMax = counter.data[0].current_max + 1;
    await db.collection('seq_counters').doc(counter.data[0]._id).update({
      data: { current_max: newMax }
    });
    return newMax;
  }

  // 3. 新建计数器
  await db.collection('seq_counters').add({
    data: {
      inventory_id: inventoryId,
      main_zone: mainZone,
      sub_zone: subZone,
      current_max: 1
    }
  });
  return 1;
}
```

#### 出库库存校验

```javascript
// 在 outbound/createOrder 中
async function validateStock(db, productId, requestQty) {
  const product = await db.collection('products').doc(productId).get();
  const available = product.data.quantity - product.data.reserved_quantity;
  if (requestQty > available) {
    return { valid: false, available, message: `可用库存不足：${available}` };
  }
  return { valid: true, available, product: product.data };
}
```

---

## 5. 云存储设计

### 5.1 目录结构

```
cloud://goodser-xxx.6765-goodser-xxx/
└── images/
    └── {product_id}/
        ├── main.jpg           ← 头图
        ├── extra_001.jpg      ← 额外图片
        └── extra_002.jpg
```

### 5.2 上传流程

```
小程序端：
  1. wx.chooseImage() / wx.chooseMedia() → 获取临时文件路径
  2. wx.compressImage() → 压缩（quality: 80, max 2MB）
  3. wx.cloud.uploadFile({
       cloudPath: `images/${productId}/main.jpg`,
       filePath: tempFilePath
     })
  4. 获取 fileID: cloud://xxx.xxx/images/xxx/main.jpg
  5. 将 fileID 存入产品记录的 image_url 字段

可选：后续通过定时云函数同步到 NAS
```

### 5.3 图片加载

```javascript
// 获取临时链接（有效期 2 小时）
async function getImageUrl(fileID) {
  const res = await wx.cloud.getTempFileURL({
    fileList: [fileID]
  });
  return res.fileList[0].tempFileURL;
}
```

### 5.4 混合存储策略（可选）

如果同时有 NAS，云存储作为热存储（最新上传），NAS 作为冷存储（持久化）。

```
新上传图片
    │
    ▼
云存储（CDN 加速，快速访问）
    │  定时触发
    ▼
nas-sync 云函数 → NAS 存储
    │  90 天后
    ▼
云存储旧文件清理
```

---

## 6. API 接口设计（云函数调用）

### 6.1 调用方式

云函数调用不通过 HTTP，而是使用 `wx.cloud.callFunction()`：

```javascript
// 前端调用示例
async function getProducts(inventoryId, params) {
  const res = await wx.cloud.callFunction({
    name: 'product',
    data: {
      action: 'list',
      inventory_id: inventoryId,
      page: params.page || 1,
      page_size: params.pageSize || 20,
      keyword: params.keyword,
      main_zone: params.mainZone,
      status_code: params.statusCode,
      tag_ids: params.tagIds,
      sort_by: params.sortBy,
      sort_order: params.sortOrder
    }
  });
  return res.result;  // { code: 0, data: { items: [...], total: 100 } }
}
```

### 6.2 统一封装（db.js）

替换当前的 `mock-data.js`：

```javascript
// utils/db.js — 替代 mock-data.js
const db = wx.cloud.database();
const _ = db.command;

async function callFunction(name, action, data = {}) {
  try {
    const res = await wx.cloud.callFunction({
      name,
      data: { action, ...data }
    });
    if (res.result.code !== 0) {
      wx.showToast({ title: res.result.message, icon: 'none' });
      throw new Error(res.result.message);
    }
    return res.result.data;
  } catch (err) {
    console.error(`云函数调用失败: ${name}/${action}`, err);
    throw err;
  }
}

// 对应 mock-data.js 的导出
module.exports = {
  // 库存目录
  getInventories: () => callFunction('inventory', 'list'),
  createInventory: (name) => callFunction('inventory', 'create', { name }),
  updateInventory: (id, data) => callFunction('inventory', 'update', { id, ...data }),
  deleteInventory: (id) => callFunction('inventory', 'remove', { id }),
  getInventoryStats: (id) => callFunction('inventory', 'stats', { id }),

  // 商品
  getProducts: (inventoryId, params) =>
    callFunction('product', 'list', { inventory_id: inventoryId, ...params }),
  getProduct: (id) => callFunction('product', 'detail', { id }),
  createProduct: (inventoryId, data) =>
    callFunction('product', 'create', { inventory_id: inventoryId, ...data }),
  updateProduct: (id, data) =>
    callFunction('product', 'update', { id, ...data }),
  deleteProduct: (id) => callFunction('product', 'remove', { id }),
  searchProducts: (inventoryId, keyword) =>
    callFunction('product', 'search', { inventory_id: inventoryId, keyword }),

  // 入库
  inboundSingle: (inventoryId, data) =>
    callFunction('inbound', 'single', { inventory_id: inventoryId, ...data }),
  inboundBatch: (inventoryId, items) =>
    callFunction('inbound', 'batch', { inventory_id: inventoryId, items }),
  inboundSearchImport: (inventoryId, data) =>
    callFunction('inbound', 'searchImport', { inventory_id: inventoryId, ...data }),
  getInboundLogs: (inventoryId) =>
    callFunction('inbound', 'logs', { inventory_id: inventoryId }),
  getInboundLogDetail: (logId) =>
    callFunction('inbound', 'logDetail', { log_id: logId }),
  updateInboundLog: (logId, data) =>
    callFunction('inbound', 'logUpdate', { log_id: logId, ...data }),
  deleteInboundLog: (logId) =>
    callFunction('inbound', 'logRemove', { log_id: logId }),

  // 出库
  createOutbound: (inventoryId, data) =>
    callFunction('outbound', 'createOrder', { inventory_id: inventoryId, ...data }),
  createReserve: (inventoryId, data) =>
    callFunction('outbound', 'createReserve', { inventory_id: inventoryId, ...data }),
  getOutboundOrders: (inventoryId, params) =>
    callFunction('outbound', 'orders', { inventory_id: inventoryId, ...params }),
  getOutboundDetail: (orderId) =>
    callFunction('outbound', 'orderDetail', { order_id: orderId }),
  confirmOutbound: (orderId) =>
    callFunction('outbound', 'confirm', { order_id: orderId }),
  cancelOutbound: (orderId) =>
    callFunction('outbound', 'cancel', { order_id: orderId }),
  cancelReserve: (reserveId) =>
    callFunction('outbound', 'cancelReserve', { reserve_id: reserveId }),
  reserveToOutbound: (reserveId) =>
    callFunction('outbound', 'reserveToOutbound', { reserve_id: reserveId }),

  // 设置
  getWhitelist: () => callFunction('settings', 'whitelist/list'),
  addWhitelist: (data) => callFunction('settings', 'whitelist/add', data),
  removeWhitelist: (id) => callFunction('settings', 'whitelist/remove', { id }),
  getStatusCodes: () => callFunction('settings', 'statusCodes/list'),
  addStatusCode: (data) => callFunction('settings', 'statusCodes/add', data),
  removeStatusCode: (id) => callFunction('settings', 'statusCodes/remove', { id }),
  getTags: () => callFunction('settings', 'tags/list'),
  createTag: (data) => callFunction('settings', 'tags/create', data),
  updateTag: (id, data) => callFunction('settings', 'tags/update', { id, ...data }),
  deleteTag: (id) => callFunction('settings', 'tags/remove', { id }),

  // 图片
  uploadImage: (productId, filePath) => callFunction('image', 'upload', {
    product_id: productId,
    file_path: filePath
  }),
  getImageUrl: (fileIds) => callFunction('image', 'getUrl', { file_ids: fileIds }),
  removeImage: (fileId) => callFunction('image', 'remove', { file_id: fileId }),
};
```

### 6.3 调用方改动

将现有页面中的：
```javascript
const mockData = require('../../utils/mock-data');
```
改为：
```javascript
const db = require('../../utils/db');
```

所有 `mockData.getXxx()` 替换为 `db.getXxx()`，其余业务逻辑保持不变。

---

## 7. 认证与权限

### 7.1 登录流程（云开发版）

```javascript
// app.js onLaunch
async function login() {
  // 1. 调用云函数登录
  const res = await wx.cloud.callFunction({
    name: 'auth',
    data: { action: 'login' }
  });

  if (res.result.code === 0) {
    // 2. 登录成功，存储用户信息
    wx.setStorageSync('user', res.result.data);
  } else if (res.result.code === 40300) {
    // 3. 不在白名单，跳转申请页
    wx.reLaunch({ url: '/pages/apply/index' });
  }
}
```

```javascript
// cloudfunctions/auth/index.js
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();

  if (event.action === 'login') {
    // 查白名单
    const whitelist = await db.collection('whitelist')
      .where({ openid: OPENID }).get();

    if (whitelist.data.length === 0) {
      return { code: 40300, message: '无访问权限' };
    }

    return {
      code: 0,
      data: {
        openid: OPENID,
        role: whitelist.data[0].role,
        nickname: whitelist.data[0].nickname
      }
    };
  }
};
```

### 7.2 免鉴权特性

云开发的 `wx.cloud.callFunction()` 自动在云函数中注入 `cloud.getWXContext().OPENID`，无需手动传递 Token。相比自建后端，省去了 JWT 签发、验证、刷新等全部环节。

---

## 8. 安全规则设计

### 8.1 数据库安全规则

在云开发控制台对各集合设置安全规则：

```json
// inventories — 仅创建者可读写
{
  "read": "doc.owner_openid == auth.openid",
  "write": "doc.owner_openid == auth.openid"
}

// products — 仅创建者可读写
{
  "read": "doc.owner_openid == auth.openid",
  "write": "doc.owner_openid == auth.openid"
}

// outbound_orders — 仅创建者可读写
{
  "read": "doc.owner_openid == auth.openid",
  "write": "doc.owner_openid == auth.openid"
}

// inbound_logs — 仅创建者可读写
{
  "read": "doc.owner_openid == auth.openid",
  "write": "doc.owner_openid == auth.openid"
}

// whitelist — 所有用户可读，仅管理员可写
{
  "read": true,
  "write": "auth.openid in get('database.whitelist.${auth.openid}').role == 'admin'"
}
// 简化处理：whitelist 的写操作统一走云函数（云函数不受安全规则限制）

// status_codes — 所有用户可读，仅创建者可写
{
  "read": true,
  "write": "doc.owner_openid == auth.openid"
}

// tags — 所有用户可读，仅创建者可写/删
{
  "read": true,
  "write": "doc.owner_openid == auth.openid"
}

// seq_counters / recycled_seq_numbers — 仅通过云函数操作
{
  "read": false,
  "write": false
}
```

> **关键策略**：敏感写操作（序号分配、库存扣减）全部走云函数，数据库安全规则禁止客户端直接写，避免并发问题和数据不一致。

### 8.2 前端 vs 云函数操作分离

| 操作类型 | 实现方式 | 原因 |
|----------|---------|------|
| 列表查询、详情查询 | 客户端直接 `wx.cloud.database()` | 减少云函数调用次数，利用 CDN |
| 创建/更新/删除（复杂写入） | 云函数 `callFunction()` | 事务性、权限校验、并发控制 |
| 序号分配 | 云函数 | 原子性保证 |
| 库存扣减/恢复 | 云函数 | 数据一致性 |
| 图片上传 | 客户端 `wx.cloud.uploadFile()` | 大文件直传，减少函数中转 |
| 图片 URL 获取 | 客户端 `wx.cloud.getTempFileURL()` | 简单操作 |

---

## 9. 开发调试与部署

### 9.1 开发流程

```bash
# 1. 在微信开发者工具中开启云开发
#    云开发控制台 → 设置 → 环境设置 → 创建环境

# 2. 安装云函数依赖
cd cloudfunctions/product
npm install

# 3. 上传并部署云函数
#    微信开发者工具 → 右键云函数目录 → 上传并部署：云端安装依赖

# 4. 数据库初始化
#    app.js onLaunch 中调用 init 云函数（仅首次）
wx.cloud.callFunction({ name: 'init', data: { action: 'setup' } });

# 5. 上传安全规则
#    云开发控制台 → 数据库 → 安全规则
```

### 9.2 环境管理

| 环境 | 环境 ID | 用途 |
|------|---------|------|
| 开发环境 | `goodser-dev-xxx` | 日常开发调试 |
| 生产环境 | `goodser-xxx` | 正式发布 |

### 9.3 切换到云开发的 Checklist

- [ ] 云开发环境已创建并获取环境 ID
- [ ] `app.js` 调用 `wx.cloud.init({ env })`
- [ ] 所有云函数已创建并上传部署
- [ ] 数据库集合已创建，索引已配置
- [ ] 安全规则已配置
- [ ] `utils/db.js` 已替代 `utils/mock-data.js`
- [ ] 所有页面 `require('../../utils/mock-data')` 改为 `require('../../utils/db')`
- [ ] 所有页面 API 调用改为 `async/await` 模式
- [ ] 初始化云函数已执行（种子数据）
- [ ] 首个管理员已加入白名单
- [ ] 云存储目录结构已创建
- [ ] 图片上传改为 `wx.cloud.uploadFile()`
- [ ] 商品详情页图片 URL 改为 `wx.cloud.getTempFileURL()`
- [ ] 所有操作端到端测试通过
- [ ] 灰度发布给核心用户试用的计划制定

---

## 10. 成本评估

### 10.1 免费版（基础套餐）

适用场景：1-5 人小团队，日均 500 次操作

| 资源 | 月用量估算 | 免费额度 | 是否够用 |
|------|-----------|---------|---------|
| 云函数调用 | ~15,000 次 | 100 万次 | ✅ 充裕 |
| 云函数 GBs | ~500 GBs | 4 万 GBs | ✅ 充裕 |
| 数据库读 | ~10,000 次 | 5 万次 | ✅ 够用 |
| 数据库写 | ~3,000 次 | 3 万次 | ⚠️ 接近上限 |
| 数据库容量 | ~200 MB | 2 GB | ✅ 充裕 |
| 云存储容量 | ~1 GB | 5 GB | ✅ 够用 |
| 云存储下载 | ~3 GB/月 | 5 GB | ✅ 够用 |

**预计月费**：¥0（免费额度内）

### 10.2 进阶版（按量付费）

适用场景：10+ 人团队，日均 2000+ 次操作

**预计月费**：¥50-200（超出免费额度部分按量计费）

### 10.3 成本优化建议

1. **减少数据库读次数**：列表页设置合理的 `page_size`（20 条），避免一次加载过多
2. **缓存热点数据**：状态编码列表、标签列表等变化少的用 `wx.setStorageSync` 做本地缓存
3. **图片压缩**：上传前统一压缩到 ≤500KB，减少存储和下载流量
4. **定时清理**：90 天清理不再需要的云存储文件

---

> **文档结束** — 本文档随云开发版开发进度持续更新。
