/**
 * Goodser 统一数据访问层
 * - 默认使用 Mock 数据（本地内存）
 * - 开启云开发后切换到云数据库 + 云函数
 *
 * 缓存策略（四层）：
 * 1. 分级 TTL 内存缓存 —— 按数据变更频率差异化过期时间
 * 2. wx.Storage 持久化双层缓存 —— 应用重启后 L2 自动恢复至 L1
 * 3. 差量同步（商品）—— 仅拉取 updated_at 变化记录，合并增量
 * 4. 图片本地缓存 —— 独立模块 image-cache.js
 *
 * 用量优化：
 * - 读取优先走客户端直连数据库（不计入云函数调用次数）
 * - 写入走云函数（安全规则 + 事务保证）
 * - L1/L2 缓存命中时完全避免数据库读取
 */

const mockData = require('./mock-data')

// ========== 内部状态 ==========
var _cloudReady = false
var _cloudDb = null
var _cloudCmd = null

// ---- 分级 TTL（毫秒）----
var TTL = {
  statusCodes: 30 * 60 * 1000,     // 30 分钟 —— 几乎不变
  tags:       10 * 60 * 1000,      // 10 分钟 —— 偶尔增删改
  whitelist:  10 * 60 * 1000,      // 10 分钟
  inventories: 5 * 60 * 1000,      //  5 分钟
  products:    2 * 60 * 1000,      //  2 分钟（差量同步时此值为增量间隔）
  outboundOrders: 30 * 1000,       // 30 秒
  inboundLogs:    30 * 1000        // 30 秒
}

// 默认 TTL 模式：关闭（兼容旧行为，无额外性能开销）
var _gradedTTL = wx.getStorageSync('gs_gradedTTL') === true

// ---- L1 内存缓存 ----
var _L1 = {}   // { key: { data, expireAt } }

// ---- L2 wx.Storage 持久化缓存 ----
var STORAGE_PREFIX = 'gs_cache_'
var STORAGE_META = 'gs_cache_meta'

// 缓存元信息：记录每个 key 的最后写入时间
function _loadMeta() {
  try {
    return wx.getStorageSync(STORAGE_META) || {}
  } catch (e) {
    return {}
  }
}

function _saveMeta(meta) {
  try {
    wx.setStorageSync(STORAGE_META, meta)
  } catch (e) {
    console.warn('[DB] 保存缓存元信息失败:', e)
  }
}

// ---- 差量同步标记 ----
var SYNC_PREFIX = 'gs_sync_'

function _getSyncMarker(inventoryId) {
  try {
    return wx.getStorageSync(SYNC_PREFIX + inventoryId) || { version: 0, lastSyncTime: null }
  } catch (e) {
    return { version: 0, lastSyncTime: null }
  }
}

function _setSyncMarker(inventoryId, marker) {
  try {
    wx.setStorageSync(SYNC_PREFIX + inventoryId, marker)
  } catch (e) {
    console.warn('[DB] 保存差量同步标记失败:', e)
  }
}

// ========== 模式检测 ==========

function isCloudEnabled() {
  return wx.getStorageSync('cloudDbEnabled') === true
}

function isCloudReady() {
  return _cloudReady && isCloudEnabled()
}

/**
 * 初始化云开发
 */
function initCloud(envId) {
  if (!isCloudEnabled()) return

  try {
    wx.cloud.init({
      env: envId || 'goodser-xxxxxxxxx',
      traceUser: true
    })
    _cloudDb = wx.cloud.database()
    _cloudCmd = _cloudDb.command
    _cloudReady = true
    console.log('[DB] 云开发已初始化')

    // 从 L2 Storage 恢复到 L1 内存（应用冷启动预热）
    _restoreFromStorage()
  } catch (err) {
    console.error('[DB] 云开发初始化失败:', err)
    _cloudReady = false
  }
}

// ========== 云数据库读取辅助 ==========

function _cloudRead(collectionName) {
  if (!_cloudReady || !_cloudDb) return null
  return _cloudDb.collection(collectionName)
}

async function _cloudCall(action, data) {
  if (!_cloudReady) throw new Error('云开发未就绪')
  data = data || {}
  var res = await wx.cloud.callFunction({
    name: 'goodser',
    data: Object.assign({ action: action }, data)
  })
  if (res.result && res.result.code !== 0) {
    throw new Error(res.result.message || '操作失败')
  }
  return res.result.data
}

// ========== 双层缓存核心 ==========

/**
 * 尝试从 L1 内存缓存读取
 * @returns {any|null}
 */
function _getL1(key, ttl) {
  var entry = _L1[key]
  if (!entry) return null
  if (_gradedTTL && Date.now() > entry.expireAt) {
    delete _L1[key]
    return null
  }
  return entry.data
}

/**
 * 写入 L1 内存缓存
 */
function _setL1(key, data, ttl) {
  _L1[key] = {
    data: data,
    expireAt: _gradedTTL ? (Date.now() + ttl) : Infinity
  }
}

/**
 * 尝试从 L2 wx.Storage 读取，命中则恢复到 L1
 * @returns {any|null}
 */
function _getL2(key, ttl) {
  try {
    var raw = wx.getStorageSync(STORAGE_PREFIX + key)
    if (!raw) return null

    var meta = _loadMeta()
    var stored = meta[key]
    // 检查是否过期（基于 TTL）
    if (stored && _gradedTTL && (Date.now() - stored.ts) > ttl) {
      return null  // 过期
    }

    var data = JSON.parse(raw)
    // 恢复到 L1
    _setL1(key, data, ttl)
    return data
  } catch (e) {
    return null
  }
}

/**
 * 写入 L2 wx.Storage 持久化
 */
function _setL2(key, data) {
  try {
    wx.setStorageSync(STORAGE_PREFIX + key, JSON.stringify(data))
    var meta = _loadMeta()
    meta[key] = { ts: Date.now() }
    _saveMeta(meta)
  } catch (e) {
    console.warn('[DB] L2 缓存写入失败（可能超出 10MB 限制）:', e)
  }
}

/**
 * 失效指定 key 的双层缓存
 */
function _invalidateCache(key) {
  delete _L1[key]
  try {
    wx.removeStorageSync(STORAGE_PREFIX + key)
    var meta = _loadMeta()
    delete meta[key]
    _saveMeta(meta)
  } catch (e) {}
}

/**
 * 失效所有双层缓存 + 差量标记
 */
function _invalidateAllCache() {
  _L1 = {}

  // 清理所有 gs_cache_ 前缀的 storage
  try {
    var info = wx.getStorageInfoSync()
    info.keys.forEach(function(k) {
      if (k.indexOf(STORAGE_PREFIX) === 0 || k.indexOf(SYNC_PREFIX) === 0) {
        wx.removeStorageSync(k)
      }
    })
    wx.removeStorageSync(STORAGE_META)
  } catch (e) {
    console.warn('[DB] 清理缓存失败:', e)
  }
}

/**
 * 清理过期缓存
 */
function _invalidateStaleCache() {
  var now = Date.now()
  var meta = _loadMeta()
  var changed = false

  // 清理 L1 过期项
  Object.keys(_L1).forEach(function(key) {
    if (now > _L1[key].expireAt) delete _L1[key]
  })

  // 清理 L2 过期项（根据 meta 中的时间戳）
  Object.keys(meta).forEach(function(key) {
    var ttl = _guessTTL(key)
    if (ttl && (now - meta[key].ts) > ttl) {
      try { wx.removeStorageSync(STORAGE_PREFIX + key) } catch (e) {}
      delete meta[key]
      changed = true
    }
  })

  if (changed) _saveMeta(meta)
}

function _guessTTL(key) {
  if (key.indexOf('statusCodes') === 0) return TTL.statusCodes
  if (key.indexOf('tags') === 0) return TTL.tags
  if (key.indexOf('whitelist') === 0) return TTL.whitelist
  if (key.indexOf('inventories') === 0) return TTL.inventories
  if (key.indexOf('products_') === 0) return TTL.products
  if (key.indexOf('outbound_') === 0) return TTL.outboundOrders
  if (key.indexOf('inbound_') === 0) return TTL.inboundLogs
  return null
}

/**
 * 从 L2 Storage 恢复所有有效缓存到 L1 内存（冷启动预热）
 */
function _restoreFromStorage() {
  try {
    var info = wx.getStorageInfoSync()
    var meta = _loadMeta()
    var now = Date.now()
    var count = 0

    info.keys.forEach(function(k) {
      if (k.indexOf(STORAGE_PREFIX) !== 0) return
      var shortKey = k.substring(STORAGE_PREFIX.length)
      var ttl = _guessTTL(shortKey)
      var stored = meta[shortKey]

      // 检查是否过期
      if (_gradedTTL && stored && ttl && (now - stored.ts) > ttl) return

      try {
        var raw = wx.getStorageSync(k)
        if (raw) {
          _setL1(shortKey, JSON.parse(raw), ttl || 60 * 1000)
          count++
        }
      } catch (e) {}
    })

    if (count > 0) console.log('[DB] 冷启动预热：从 Storage 恢复了 ' + count + ' 个缓存')
  } catch (e) {
    console.warn('[DB] 缓存恢复失败:', e)
  }
}

// ========== 获取当前模式 ==========

function getMode() {
  return isCloudReady() ? 'cloud' : 'mock'
}

// ========== 直接导出数组（兼容 mock-data 的直接访问）==========

var inventories = mockData.inventories
var products = mockData.products
var outboundOrders = mockData.outboundOrders
var inboundLogs = mockData.inboundLogs
var whitelist = mockData.whitelist
var statusCodes = mockData.statusCodes
var tags = mockData.tags

// ========== 云模式数据加载 ==========

/**
 * 加载商品列表（差量同步）
 * 首次全量拉取 → 后续只拉取 updated_at 大于 lastSyncTime 的商品
 */
async function loadProducts(inventoryId, forceRefresh) {
  if (!isCloudReady()) return products.filter(function(p) { return p.inventory_id === inventoryId })

  var cacheKey = 'products_' + inventoryId
  var ttl = TTL.products

  // 双层读取：L1 → L2
  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl)
    if (l1) return l1
    // L2
    var l2 = _getL2(cacheKey, ttl)
    if (l2) return l2
  }

  try {
    var coll = _cloudRead('products')
    if (!coll) return []

    var syncMarker = _getSyncMarker(inventoryId)
    var allData

    if (syncMarker.lastSyncTime && !forceRefresh) {
      // === 差量同步 ===
      console.log('[DB] 差量同步 products/' + inventoryId + '，上次同步: ' + syncMarker.lastSyncTime)

      // 获取更新的记录
      var changedRes = await coll
        .where({
          inventory_id: inventoryId,
          updated_at: _cloudCmd.gt(syncMarker.lastSyncTime)
        })
        .limit(200)
        .get()

      // 获取被删除的记录（软标识：cloud DB 不支持直接查 deleted，但可通过对比差量处理）
      // 这里简化：获取远程所有 ID → 与 L2 缓存比较 → 移除本地多余的

      // 合并：L2 缓存数据 + 变更数据
      var existingData = l2 || []

      // 用 Map 合并
      var mergedMap = {}
      existingData.forEach(function(item) { mergedMap[item._id] = item })
      changedRes.data.forEach(function(item) { mergedMap[item._id] = item })

      allData = Object.values(mergedMap)

      // 统计
      var newCount = 0
      var updatedCount = 0
      changedRes.data.forEach(function(item) {
        if (existingData.some(function(e) { return e._id === item._id })) updatedCount++
        else newCount++
      })
      console.log('[DB] 差量同步完成：新增 ' + newCount + '，更新 ' + updatedCount)

      // 更新同步标记
      var maxTime = syncMarker.lastSyncTime
      changedRes.data.forEach(function(item) {
        if (item.updated_at > maxTime) maxTime = item.updated_at
      })
      _setSyncMarker(inventoryId, {
        version: syncMarker.version + 1,
        lastSyncTime: maxTime
      })
    } else {
      // === 全量同步（首次或无标记） ===
      console.log('[DB] 全量同步 products/' + inventoryId)
      var res = await coll
        .where({ inventory_id: inventoryId })
        .limit(200)
        .get()
      allData = res.data

      // 建立同步标记
      var maxTime = '1970-01-01 00:00:00'
      allData.forEach(function(item) {
        if (item.updated_at && item.updated_at > maxTime) maxTime = item.updated_at
      })
      _setSyncMarker(inventoryId, {
        version: 1,
        lastSyncTime: maxTime
      })
    }

    _setL1(cacheKey, allData, ttl)
    _setL2(cacheKey, allData)
    return allData
  } catch (err) {
    console.error('[DB] loadProducts 失败:', err)

    // 降级：尝试返回 L2 过期数据
    try {
      var raw = wx.getStorageSync(STORAGE_PREFIX + cacheKey)
      if (raw) {
        console.warn('[DB] 使用过期缓存数据')
        return JSON.parse(raw)
      }
    } catch (e) {}

    return []
  }
}

/**
 * 加载标签列表（双层缓存）
 */
async function loadTags(forceRefresh) {
  if (!isCloudReady()) return tags.slice()

  var cacheKey = 'tags'
  var ttl = TTL.tags

  if (!forceRefresh) {
    // L1
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    // L2
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('tags')
    if (!coll) return []
    var res = await coll.limit(100).get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadTags 失败:', err)
    return []
  }
}

/**
 * 加载状态编码列表（双层缓存）
 */
async function loadStatusCodes(forceRefresh) {
  if (!isCloudReady()) return statusCodes.slice()

  var cacheKey = 'statusCodes'
  var ttl = TTL.statusCodes

  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('status_codes')
    if (!coll) return []
    var res = await coll.limit(30).get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadStatusCodes 失败:', err)
    return []
  }
}

/**
 * 加载库存目录列表（双层缓存）
 */
async function loadInventories(forceRefresh) {
  if (!isCloudReady()) return inventories.slice()

  var cacheKey = 'inventories'
  var ttl = TTL.inventories

  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('inventories')
    if (!coll) return []
    var res = await coll.orderBy('sort_order', 'asc').limit(50).get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadInventories 失败:', err)
    return []
  }
}

/**
 * 加载出库单列表
 */
async function loadOutboundOrders(inventoryId, forceRefresh) {
  if (!isCloudReady()) return outboundOrders.filter(function(o) { return o.inventory_id === inventoryId })

  var cacheKey = 'outbound_' + inventoryId
  var ttl = TTL.outboundOrders

  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('outbound_orders')
    if (!coll) return []
    var res = await coll
      .where({ inventory_id: inventoryId })
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadOutboundOrders 失败:', err)
    return []
  }
}

/**
 * 加载入库日志列表
 */
async function loadInboundLogs(inventoryId, forceRefresh) {
  if (!isCloudReady()) return inboundLogs.filter(function(l) { return l.inventory_id === inventoryId })

  var cacheKey = 'inbound_' + inventoryId
  var ttl = TTL.inboundLogs

  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('inbound_logs')
    if (!coll) return []
    var res = await coll
      .where({ inventory_id: inventoryId })
      .orderBy('created_at', 'desc')
      .limit(100)
      .get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadInboundLogs 失败:', err)
    return []
  }
}

/**
 * 加载白名单（双层缓存）
 */
async function loadWhitelist(forceRefresh) {
  if (!isCloudReady()) return whitelist.slice()

  var cacheKey = 'whitelist'
  var ttl = TTL.whitelist

  if (!forceRefresh) {
    var l1 = _getL1(cacheKey, ttl); if (l1) return l1
    var l2 = _getL2(cacheKey, ttl); if (l2) return l2
  }

  try {
    var coll = _cloudRead('whitelist')
    if (!coll) return []
    var res = await coll.limit(200).get()
    _setL1(cacheKey, res.data, ttl)
    _setL2(cacheKey, res.data)
    return res.data
  } catch (err) {
    console.error('[DB] loadWhitelist 失败:', err)
    return []
  }
}

// ========== 强制刷新 API ==========

/**
 * 强制刷新指定类型的所有缓存
 * @param {string} type - 'products'|'tags'|'statusCodes'|'inventories'|'outboundOrders'|'inboundLogs'|'whitelist'|'all'
 */
async function forceRefresh(type) {
  if (!isCloudReady()) return

  if (type === 'all' || type === 'products') {
    // 清除所有差量同步标记
    try {
      var info = wx.getStorageInfoSync()
      info.keys.forEach(function(k) {
        if (k.indexOf(SYNC_PREFIX) === 0) wx.removeStorageSync(k)
      })
    } catch (e) {}

    // 清除产品相关缓存
    Object.keys(_L1).forEach(function(k) {
      if (k.indexOf('products_') === 0) delete _L1[k]
    })
    try {
      var info2 = wx.getStorageInfoSync()
      info2.keys.forEach(function(k) {
        if (k.indexOf(STORAGE_PREFIX + 'products_') === 0) wx.removeStorageSync(k)
      })
    } catch (e) {}
  }

  if (type === 'all' || type === 'tags')           _invalidateCache('tags')
  if (type === 'all' || type === 'statusCodes')    _invalidateCache('statusCodes')
  if (type === 'all' || type === 'whitelist')      _invalidateCache('whitelist')
  if (type === 'all' || type === 'inventories')    _invalidateCache('inventories')
  if (type === 'all' || type === 'outboundOrders') {
    Object.keys(_L1).forEach(function(k) {
      if (k.indexOf('outbound_') === 0) delete _L1[k]
    })
  }
  if (type === 'all' || type === 'inboundLogs') {
    Object.keys(_L1).forEach(function(k) {
      if (k.indexOf('inbound_') === 0) delete _L1[k]
    })
  }

  console.log('[DB] 强制刷新完成:', type)
}

// ========== 写入操作（mock 模式直接操作数组，cloud 模式调用云函数）==========

// --- 库存目录 ---

async function createInventory(data) {
  if (!isCloudReady()) {
    var newInv = {
      _id: 'inv_' + Date.now(),
      name: data.name,
      owner_openid: 'user_001',
      sort_order: mockData.inventories.length,
      created_at: new Date().toLocaleString(),
      updated_at: new Date().toLocaleString()
    }
    mockData.inventories.push(newInv)
    return newInv
  }
  var result = await _cloudCall('createInventory', data)
  _invalidateCache('inventories')
  return result
}

async function updateInventory(id, data) {
  if (!isCloudReady()) {
    var inv = mockData.inventories.find(function(i) { return i._id === id })
    if (inv) {
      if (data.name !== undefined) inv.name = data.name
      inv.updated_at = new Date().toLocaleString()
    }
    return inv
  }
  var result = await _cloudCall('updateInventory', Object.assign({ id: id }, data))
  _invalidateCache('inventories')
  return result
}

async function deleteInventory(id) {
  if (!isCloudReady()) {
    var idx = mockData.inventories.findIndex(function(i) { return i._id === id })
    if (idx > -1) mockData.inventories.splice(idx, 1)
    for (var i = mockData.products.length - 1; i >= 0; i--) {
      if (mockData.products[i].inventory_id === id) mockData.products.splice(i, 1)
    }
    return
  }
  await _cloudCall('deleteInventory', { id: id })
  _invalidateAllCache()
}

// --- 商品 ---

async function createProduct(data) {
  if (!isCloudReady()) {
    var newProduct = {
      _id: 'prod_' + Date.now(),
      inventory_id: data.inventory_id,
      code: data.code, main_zone: data.main_zone, sub_zone: data.sub_zone,
      seq_number: data.seq_number, quantity: data.quantity || 0,
      reserved_quantity: 0, status_code: data.status_code,
      name: data.name, original_price: data.original_price || 0,
      market_price: data.market_price || 0, expected_price: data.expected_price || 0,
      remark: data.remark || '', storage_location: data.storage_location || '',
      image_url: data.image_url || '', tags: data.tags || [],
      owner_openid: 'user_001',
      created_at: new Date().toLocaleString(), updated_at: new Date().toLocaleString()
    }
    mockData.products.push(newProduct)
    return newProduct
  }
  var result = await _cloudCall('createProduct', data)
  _invalidateCache('products_' + data.inventory_id)
  return result
}

async function updateProduct(id, data) {
  if (!isCloudReady()) {
    var product = mockData.products.find(function(p) { return p._id === id })
    if (product) {
      Object.keys(data).forEach(function(key) {
        if (key !== '_id' && key !== 'inventory_id') product[key] = data[key]
      })
      product.updated_at = new Date().toLocaleString()
    }
    return product
  }
  var result = await _cloudCall('updateProduct', Object.assign({ id: id }, data))
  _invalidateAllCache()
  return result
}

async function deleteProduct(id) {
  if (!isCloudReady()) {
    var idx = mockData.products.findIndex(function(p) { return p._id === id })
    if (idx > -1) mockData.products.splice(idx, 1)
    return
  }
  await _cloudCall('deleteProduct', { id: id })
  _invalidateAllCache()
}

// --- 序号分配 ---

async function allocateSeqNumber(inventoryId, mainZone, subZone) {
  if (!isCloudReady()) {
    var usedSeqs = products
      .filter(function(p) { return p.inventory_id === inventoryId && p.main_zone === mainZone && p.sub_zone === subZone })
      .map(function(p) { return p.seq_number })
      .filter(function(n) { return n > 0 })
      .sort(function(a, b) { return a - b })
    if (usedSeqs.length === 0) return 1
    for (var i = 1; i <= usedSeqs.length; i++) {
      if (usedSeqs.indexOf(i) === -1) return i
    }
    return usedSeqs[usedSeqs.length - 1] + 1
  }
  var result = await _cloudCall('allocateSeq', { inventoryId: inventoryId, mainZone: mainZone, subZone: subZone })
  return result.seqNumber
}

// --- 出库单 ---

async function createOutboundOrder(data) {
  if (!isCloudReady()) {
    var newOrder = {
      _id: data._id || ('out_' + Date.now()), inventory_id: data.inventory_id,
      order_no: data.order_no, type: data.type || 'outbound',
      status: data.status || 'pending', order_info: data.order_info || '',
      remark: data.remark || '', items: data.items || [],
      source_reserve_id: data.source_reserve_id || null,
      owner_openid: 'user_001',
      created_at: new Date().toLocaleString(), updated_at: new Date().toLocaleString(),
      confirmed_at: data.confirmed_at || null, cancelled_at: data.cancelled_at || null
    }
    mockData.outboundOrders.push(newOrder)
    return newOrder
  }
  var result = await _cloudCall('createOutbound', data)
  _invalidateCache('outbound_' + data.inventory_id)
  return result
}

async function confirmOutbound(id) {
  if (!isCloudReady()) {
    var order = mockData.outboundOrders.find(function(o) { return o._id === id })
    if (order) {
      order.status = 'confirmed'
      order.confirmed_at = new Date().toLocaleString()
      order.updated_at = new Date().toLocaleString()
    }
    return order
  }
  var result = await _cloudCall('confirmOutbound', { id: id })
  _invalidateAllCache()
  return result
}

async function cancelOutbound(id) {
  if (!isCloudReady()) {
    var order = mockData.outboundOrders.find(function(o) { return o._id === id })
    if (order) {
      order.items.forEach(function(item) {
        var product = mockData.products.find(function(p) { return p._id === item.product_id })
        if (product) { product.quantity += item.quantity; product.updated_at = new Date().toLocaleString() }
      })
      order.status = 'cancelled'
      order.cancelled_at = new Date().toLocaleString()
      order.updated_at = new Date().toLocaleString()
    }
    return order
  }
  var result = await _cloudCall('cancelOutbound', { id: id })
  _invalidateAllCache()
  return result
}

async function cancelReserve(id) {
  if (!isCloudReady()) {
    var reserve = mockData.outboundOrders.find(function(o) { return o._id === id })
    if (reserve) {
      reserve.items.forEach(function(item) {
        var product = mockData.products.find(function(p) { return p._id === item.product_id })
        if (product) { product.reserved_quantity = Math.max(0, product.reserved_quantity - item.quantity); product.updated_at = new Date().toLocaleString() }
      })
      reserve.status = 'cancelled'
      reserve.cancelled_at = new Date().toLocaleString()
      reserve.updated_at = new Date().toLocaleString()
    }
    return reserve
  }
  var result = await _cloudCall('cancelReserve', { id: id })
  _invalidateAllCache()
  return result
}

async function reserveToOutbound(id, data) {
  if (!isCloudReady()) {
    var reserve = mockData.outboundOrders.find(function(o) { return o._id === id })
    if (reserve) {
      reserve.status = 'confirmed'
      reserve.confirmed_at = new Date().toLocaleString()
      reserve.updated_at = new Date().toLocaleString()
      reserve.items.forEach(function(item) {
        var product = mockData.products.find(function(p) { return p._id === item.product_id })
        if (product) { product.reserved_quantity = Math.max(0, product.reserved_quantity - item.quantity); product.updated_at = new Date().toLocaleString() }
      })
      var newOrder = {
        _id: data._id || ('out_' + Date.now()), inventory_id: data.inventory_id,
        order_no: data.order_no, type: 'outbound', status: 'pending',
        order_info: data.order_info || '', remark: data.remark || '',
        items: data.items || [], source_reserve_id: id,
        owner_openid: 'user_001',
        created_at: new Date().toLocaleString(), updated_at: new Date().toLocaleString(),
        confirmed_at: null, cancelled_at: null
      }
      mockData.outboundOrders.push(newOrder)
      return newOrder
    }
    return reserve
  }
  var result = await _cloudCall('reserveToOutbound', Object.assign({ id: id }, data))
  _invalidateAllCache()
  return result
}

// --- 入库日志 ---

async function createInboundLog(data) {
  if (!isCloudReady()) {
    var newLog = {
      _id: 'inlog_' + Date.now(), inventory_id: data.inventory_id,
      order_no: data.order_no, type: data.type || 'single',
      remark: data.remark || '', items: data.items || [],
      owner_openid: 'user_001', created_at: new Date().toLocaleString()
    }
    mockData.inboundLogs.push(newLog)
    return newLog
  }
  var result = await _cloudCall('createInboundLog', data)
  _invalidateCache('inbound_' + data.inventory_id)
  return result
}

async function updateInboundLog(id, data) {
  if (!isCloudReady()) {
    var log = mockData.inboundLogs.find(function(l) { return l._id === id })
    if (log) { Object.keys(data).forEach(function(key) { if (key !== '_id') log[key] = data[key] }) }
    return log
  }
  var result = await _cloudCall('updateInboundLog', Object.assign({ id: id }, data))
  _invalidateAllCache()
  return result
}

async function deleteInboundLog(id) {
  if (!isCloudReady()) {
    var idx = mockData.inboundLogs.findIndex(function(l) { return l._id === id })
    if (idx > -1) mockData.inboundLogs.splice(idx, 1)
    return
  }
  await _cloudCall('deleteInboundLog', { id: id })
  _invalidateAllCache()
}

// --- 标签 ---

async function createTag(data) {
  if (!isCloudReady()) {
    var newTag = { _id: 'tag_' + Date.now(), name: data.name, color: data.color || '#1890ff', owner_openid: 'user_001', created_at: new Date().toLocaleString() }
    mockData.tags.push(newTag)
    return newTag
  }
  var result = await _cloudCall('createTag', data)
  _invalidateCache('tags')
  return result
}

async function updateTag(id, data) {
  if (!isCloudReady()) {
    var tag = mockData.tags.find(function(t) { return t._id === id })
    if (tag) { if (data.name !== undefined) tag.name = data.name; if (data.color !== undefined) tag.color = data.color }
    return tag
  }
  var result = await _cloudCall('updateTag', Object.assign({ id: id }, data))
  _invalidateCache('tags')
  return result
}

async function deleteTag(id) {
  if (!isCloudReady()) {
    var idx = mockData.tags.findIndex(function(t) { return t._id === id })
    if (idx > -1) mockData.tags.splice(idx, 1)
    return
  }
  await _cloudCall('deleteTag', { id: id })
  _invalidateCache('tags')
}

// --- 白名单 ---

async function addWhitelist(data) {
  if (!isCloudReady()) {
    var newEntry = { _id: 'wl_' + Date.now(), openid: data.openid || 'user_' + Date.now(), nickname: data.nickname || '', avatar_url: data.avatar_url || '', role: data.role || 'member', added_by: 'user_001', created_at: new Date().toLocaleString() }
    mockData.whitelist.push(newEntry)
    return newEntry
  }
  var result = await _cloudCall('addWhitelist', data)
  _invalidateCache('whitelist')
  return result
}

async function removeWhitelist(id) {
  if (!isCloudReady()) {
    var idx = mockData.whitelist.findIndex(function(w) { return w._id === id })
    if (idx > -1) mockData.whitelist.splice(idx, 1)
    return
  }
  await _cloudCall('removeWhitelist', { id: id })
  _invalidateCache('whitelist')
}

// --- 状态编码 ---

async function addStatusCode(data) {
  if (!isCloudReady()) {
    var newCode = { _id: 'sc_' + data.code, code: data.code, label: data.label, is_system: false, owner_openid: 'user_001', created_at: new Date().toLocaleString() }
    mockData.statusCodes.push(newCode)
    return newCode
  }
  var result = await _cloudCall('addStatusCode', data)
  _invalidateCache('statusCodes')
  return result
}

async function removeStatusCode(id) {
  if (!isCloudReady()) {
    var idx = mockData.statusCodes.findIndex(function(s) { return s._id === id })
    if (idx > -1) mockData.statusCodes.splice(idx, 1)
    return
  }
  await _cloudCall('removeStatusCode', { id: id })
  _invalidateCache('statusCodes')
}

// --- 入库操作（事务性）---

async function inboundSingle(data) {
  if (!isCloudReady()) return null
  var result = await _cloudCall('inboundSingle', data)
  _invalidateAllCache()
  return result
}

async function inboundBatch(data) {
  if (!isCloudReady()) return null
  var result = await _cloudCall('inboundBatch', data)
  _invalidateAllCache()
  return result
}

async function inboundSearchImport(data) {
  if (!isCloudReady()) return null
  var result = await _cloudCall('inboundSearchImport', data)
  _invalidateAllCache()
  return result
}

// ========== 设置页用：缓存管理 API ==========

/**
 * 获取缓存统计信息
 */
function getCacheStats() {
  var l1Count = Object.keys(_L1).length

  var storageCount = 0
  var storageKB = 0
  try {
    var info = wx.getStorageInfoSync()
    info.keys.forEach(function(k) {
      if (k.indexOf(STORAGE_PREFIX) === 0) {
        storageCount++
        // 估算大小
        var raw = wx.getStorageSync(k)
        if (typeof raw === 'string') storageKB += raw.length / 1024
      }
    })
  } catch (e) {}

  return {
    l1Count: l1Count,
    storageCount: storageCount,
    storageKB: Math.round(storageKB * 10) / 10,
    gradedTTL: _gradedTTL
  }
}

/**
 * 获取差量同步信息
 */
function getSyncInfo() {
  var info = []
  try {
    var allKeys = wx.getStorageInfoSync().keys
    allKeys.forEach(function(k) {
      if (k.indexOf(SYNC_PREFIX) === 0) {
        var marker = wx.getStorageSync(k)
        if (marker) {
          info.push({
            inventoryId: k.substring(SYNC_PREFIX.length),
            version: marker.version || 0,
            lastSyncTime: marker.lastSyncTime || '未同步'
          })
        }
      }
    })
  } catch (e) {}
  return info
}

/**
 * 获取/设置分级 TTL 开关
 */
function isGradedTTLEnabled() { return _gradedTTL }
function setGradedTTL(enabled) {
  _gradedTTL = !!enabled
  wx.setStorageSync('gs_gradedTTL', _gradedTTL)

  if (!enabled) {
    // 关闭分级 TTL：清除所有过期时间（设为 Infinity，即永不过期直到手动清除）
    Object.keys(_L1).forEach(function(key) {
      if (_L1[key]) _L1[key].expireAt = Infinity
    })
  } else {
    // 开启分级 TTL：立即套用过期规则，清理已过期的
    _invalidateStaleCache()
  }
}

/**
 * 清理所有缓存（L1 + L2 + 差量标记）
 */
function clearAllCache() {
  _invalidateAllCache()
}

/**
 * 清理过期缓存
 */
function clearStaleCache() {
  _invalidateStaleCache()
}

// ========== 导出 ==========

module.exports = {
  // 数组直接访问（兼容现有 mock-data 用法 —— Mock 模式下直接读写）
  inventories: inventories,
  products: products,
  outboundOrders: outboundOrders,
  inboundLogs: inboundLogs,
  whitelist: whitelist,
  statusCodes: statusCodes,
  tags: tags,

  // 模式管理
  initCloud: initCloud,
  isCloudEnabled: isCloudEnabled,
  isCloudReady: isCloudReady,
  getMode: getMode,

  // 云模式数据加载（支持 forceRefresh 参数）
  loadProducts: loadProducts,
  loadTags: loadTags,
  loadStatusCodes: loadStatusCodes,
  loadInventories: loadInventories,
  loadOutboundOrders: loadOutboundOrders,
  loadInboundLogs: loadInboundLogs,
  loadWhitelist: loadWhitelist,

  // 强制刷新
  forceRefresh: forceRefresh,

  // 写入操作（Mock 模式直接修改数组，Cloud 模式调用云函数）
  createInventory: createInventory,
  updateInventory: updateInventory,
  deleteInventory: deleteInventory,
  createProduct: createProduct,
  updateProduct: updateProduct,
  deleteProduct: deleteProduct,
  allocateSeqNumber: allocateSeqNumber,
  createOutboundOrder: createOutboundOrder,
  confirmOutbound: confirmOutbound,
  cancelOutbound: cancelOutbound,
  cancelReserve: cancelReserve,
  reserveToOutbound: reserveToOutbound,
  createInboundLog: createInboundLog,
  updateInboundLog: updateInboundLog,
  deleteInboundLog: deleteInboundLog,
  inboundSingle: inboundSingle,
  inboundBatch: inboundBatch,
  inboundSearchImport: inboundSearchImport,
  createTag: createTag,
  updateTag: updateTag,
  deleteTag: deleteTag,
  addWhitelist: addWhitelist,
  removeWhitelist: removeWhitelist,
  addStatusCode: addStatusCode,
  removeStatusCode: removeStatusCode,

  // 缓存管理（设置页面使用）
  getCacheStats: getCacheStats,
  getSyncInfo: getSyncInfo,
  isGradedTTLEnabled: isGradedTTLEnabled,
  setGradedTTL: setGradedTTL,
  clearAllCache: clearAllCache,
  clearStaleCache: clearStaleCache
}
