const db = require('../../utils/db')
const imgCache = require('../../utils/image-cache')

Page({
  data: {
    // 基本信息
    whitelistCount: 0,
    statusCodeCount: 0,
    tagCount: 0,
    nasConnected: false,

    // 云数据库
    cloudDbEnabled: false,
    cloudDbStatus: '未连接',

    // NAS 私有云模式
    nasEnabled: false,
    nasStatus: '未连接',

    // 自建后端模式
    selfBuiltEnabled: false,
    selfBuiltStatus: '未连接',

    // 缓存管理
    gradedTTL: false,
    cacheL1Count: 0,
    cacheStorageCount: 0,
    cacheStorageKB: '0',

    // 差量同步
    syncInfo: [],

    // 图片缓存
    imageCacheCount: 0,
    imageCacheKB: '0',

    // 全量同步状态
    syncing: false,
    syncProgress: '',
    lastSyncTime: '',
    lastSyncDetail: null,
    showSyncDetail: false,

    // 设置项显示控制（每个功能点）
    showWhitelist: true,
    showStatusCodes: true,
    showTags: true,
    showSelfBuiltConfig: true,
    showNasConfig: true,
    showCloudDb: true,
    showCloudDbStatus: true,
    showSelfBuilt: true,
    showSelfBuiltStatus: true,
    showSyncAll: true,
    showSyncProgress: true,
    showLastSync: true,
    showGradedTTL: true,
    showCacheStatus: true,
    showForceRefresh: true,
    showClearAllCache: true,
    showClearStaleCache: true,
    showDiffSync: true,
    showImageCacheStatus: true,
    showClearImageCache: true,
    showClearUnusedImages: true,
    showAboutSection: true
  },

  onShow() {
    this._refreshAll()
  },

  _refreshAll() {
    var cloudEnabled = wx.getStorageSync('cloudDbEnabled') || false
    var cloudStatusText = cloudEnabled
      ? (db.isCloudReady() ? '已连接' : '连接中…')
      : '未连接'

    var nasEnabled = wx.getStorageSync('nasEnabled') || false
    var nasStatusText = '未连接'
    if (nasEnabled) {
      if (db.isNASReady()) {
        nasStatusText = '已连接'
      } else {
        // 尝试从已保存的配置初始化 NAS
        var savedConfig = null
        try {
          var raw = wx.getStorageSync('nasConfig')
          if (raw) savedConfig = JSON.parse(raw)
        } catch (e) {}
        if (savedConfig && savedConfig.baseUrl) {
          // 未调用过 initNAS，但配置已存在——说明刚从配置页返回
          db.initNAS(savedConfig)
          nasStatusText = db.isNASReady() ? '已连接' : '连接失败'
        } else {
          nasStatusText = '未连接（请先配置 NAS 地址）'
        }
      }
    }

    var selfBuiltEnabled = wx.getStorageSync('selfBuiltEnabled') || false
    var selfBuiltStatusText = '未连接'
    if (selfBuiltEnabled) {
      if (db.isSelfBuiltReady()) {
        selfBuiltStatusText = '已连接'
      } else {
        var savedSelfBuilt = null
        try {
          var raw = wx.getStorageSync('selfBuiltConfig')
          if (raw) savedSelfBuilt = JSON.parse(raw)
        } catch (e) {}
        if (savedSelfBuilt && savedSelfBuilt.baseUrl) {
          db.initSelfBuilt(savedSelfBuilt)
          selfBuiltStatusText = db.isSelfBuiltReady() ? '已连接' : '连接失败'
        } else {
          selfBuiltStatusText = '未连接（请先配置后端地址）'
        }
      }
    }

    var cacheStats = db.getCacheStats()
    var syncInfo = db.getSyncInfo()
    var imgStats = imgCache.getImageStats()

    // 读取设置项显示控制状态
    var vis = {}
    try { vis = JSON.parse(wx.getStorageSync('settingsVisibility') || '{}') } catch(e) {}
    var showWhitelist = vis.showWhitelist !== undefined ? vis.showWhitelist : true
    var showStatusCodes = vis.showStatusCodes !== undefined ? vis.showStatusCodes : true
    var showTags = vis.showTags !== undefined ? vis.showTags : true
    var showSelfBuiltConfig = vis.showSelfBuiltConfig !== undefined ? vis.showSelfBuiltConfig : true
    var showNasConfig = vis.showNasConfig !== undefined ? vis.showNasConfig : true
    var showCloudDb = vis.showCloudDb !== undefined ? vis.showCloudDb : true
    var showCloudDbStatus = vis.showCloudDbStatus !== undefined ? vis.showCloudDbStatus : true
    var showSelfBuilt = vis.showSelfBuilt !== undefined ? vis.showSelfBuilt : true
    var showSelfBuiltStatus = vis.showSelfBuiltStatus !== undefined ? vis.showSelfBuiltStatus : true
    var showSyncAll = vis.showSyncAll !== undefined ? vis.showSyncAll : true
    var showSyncProgress = vis.showSyncProgress !== undefined ? vis.showSyncProgress : true
    var showLastSync = vis.showLastSync !== undefined ? vis.showLastSync : true
    var showGradedTTL = vis.showGradedTTL !== undefined ? vis.showGradedTTL : true
    var showCacheStatus = vis.showCacheStatus !== undefined ? vis.showCacheStatus : true
    var showForceRefresh = vis.showForceRefresh !== undefined ? vis.showForceRefresh : true
    var showClearAllCache = vis.showClearAllCache !== undefined ? vis.showClearAllCache : true
    var showClearStaleCache = vis.showClearStaleCache !== undefined ? vis.showClearStaleCache : true
    var showDiffSync = vis.showDiffSync !== undefined ? vis.showDiffSync : true
    var showImageCacheStatus = vis.showImageCacheStatus !== undefined ? vis.showImageCacheStatus : true
    var showClearImageCache = vis.showClearImageCache !== undefined ? vis.showClearImageCache : true
    var showClearUnusedImages = vis.showClearUnusedImages !== undefined ? vis.showClearUnusedImages : true
    var showAboutSection = vis.showAboutSection !== undefined ? vis.showAboutSection : true

    // 读取上次全量同步时间和详情
    var lastSync = ''
    var lastSyncDetail = null
    try {
      lastSync = wx.getStorageSync('gs_last_full_sync') || ''
      var rawDetail = wx.getStorageSync('gs_last_full_sync_detail')
      if (rawDetail) lastSyncDetail = JSON.parse(rawDetail)
    } catch (e) {}

    this.setData({
      showWhitelist: showWhitelist,
      showStatusCodes: showStatusCodes,
      showTags: showTags,
      showSelfBuiltConfig: showSelfBuiltConfig,
      showNasConfig: showNasConfig,
      showCloudDb: showCloudDb,
      showCloudDbStatus: showCloudDbStatus,
      showSelfBuilt: showSelfBuilt,
      showSelfBuiltStatus: showSelfBuiltStatus,
      showSyncAll: showSyncAll,
      showSyncProgress: showSyncProgress,
      showLastSync: showLastSync,
      showGradedTTL: showGradedTTL,
      showCacheStatus: showCacheStatus,
      showForceRefresh: showForceRefresh,
      showClearAllCache: showClearAllCache,
      showClearStaleCache: showClearStaleCache,
      showDiffSync: showDiffSync,
      showImageCacheStatus: showImageCacheStatus,
      showClearImageCache: showClearImageCache,
      showClearUnusedImages: showClearUnusedImages,
      showAboutSection: showAboutSection,
      whitelistCount: db.whitelist.length,
      cloudDbStatus: cloudStatusText,
      nasEnabled: nasEnabled,
      nasStatus: nasStatusText,
      selfBuiltEnabled: selfBuiltEnabled,
      selfBuiltStatus: selfBuiltStatusText,
      gradedTTL: cacheStats.gradedTTL,
      cacheL1Count: cacheStats.l1Count,
      cacheStorageCount: cacheStats.storageCount,
      cacheStorageKB: cacheStats.storageKB.toFixed(1),
      syncInfo: syncInfo,
      imageCacheCount: imgStats.count,
      imageCacheKB: imgStats.totalKB.toFixed(1),
      lastSyncTime: lastSync,
      lastSyncDetail: lastSyncDetail
    })
  },

  // ========== 导航 ==========

  onWhitelist() { wx.navigateTo({ url: '/pages/settings/whitelist' }) },
  onStatusCodes() { wx.navigateTo({ url: '/pages/settings/status-codes' }) },
  onTags() { wx.navigateTo({ url: '/pages/settings/tags' }) },
  onNasConfig() { wx.navigateTo({ url: '/pages/settings/nas-config' }) },
  onSelfBuiltConfig() { wx.navigateTo({ url: '/pages/settings/self-built-config' }) },

  // ========== NAS 私有云模式开关 ==========

  async onNASToggle(e) {
    var enabled = e.detail.value
    this.setData({ nasEnabled: enabled, nasStatus: enabled ? '连接中…' : '未连接' })
    wx.setStorageSync('nasEnabled', enabled)

    if (enabled) {
      // 读取 NAS 配置
      var nasConfig = {}
      try {
        var raw = wx.getStorageSync('nasConfig')
        if (raw) nasConfig = JSON.parse(raw)
      } catch (e) {
        nasConfig = {}
      }

      if (!nasConfig.baseUrl) {
        wx.showModal({
          title: '请先配置 NAS',
          content: '需要先配置 NAS + 私有云的连接信息。\n\n请在「NAS 存储配置」页面填写 NAS API 地址和密钥。',
          showCancel: false,
          success: () => {
            this.setData({ nasEnabled: false, nasStatus: '未连接' })
            wx.setStorageSync('nasEnabled', false)
            wx.navigateTo({ url: '/pages/settings/nas-config' })
          }
        })
        return
      }

      wx.showLoading({ title: '连接 NAS…' })
      db.initNAS(nasConfig)
      if (!db.isNASReady()) {
        wx.hideLoading()
        wx.showModal({
          title: '连接失败',
          content: '无法初始化 NAS 模式。\n\n请检查 NAS 地址和 API 密钥是否正确配置。',
          showCancel: false
        })
        this.setData({ nasEnabled: false, nasStatus: '未连接' })
        wx.setStorageSync('nasEnabled', false)
        return
      }

      wx.hideLoading()
      wx.showToast({ title: 'NAS 模式已连接', icon: 'success' })
      this.setData({ nasStatus: '已连接', nasConnected: true })
      this._refreshAll()
    } else {
      wx.showToast({ title: '已切换为本地数据', icon: 'none' })
      this.setData({ nasStatus: '未连接', nasConnected: false })
    }
  },

  // ========== 自建后端模式开关 ==========

  async onSelfBuiltToggle(e) {
    var enabled = e.detail.value
    this.setData({ selfBuiltEnabled: enabled, selfBuiltStatus: enabled ? '连接中…' : '未连接' })
    wx.setStorageSync('selfBuiltEnabled', enabled)

    if (enabled) {
      var selfBuiltConfig = {}
      try {
        var raw = wx.getStorageSync('selfBuiltConfig')
        if (raw) selfBuiltConfig = JSON.parse(raw)
      } catch (e) {
        selfBuiltConfig = {}
      }

      if (!selfBuiltConfig.baseUrl) {
        wx.showModal({
          title: '请先配置后端地址',
          content: '需要先配置自建后端的连接信息。\n\n请在「自建后端配置」页面填写后端 API 地址和密钥。',
          showCancel: false,
          success: () => {
            this.setData({ selfBuiltEnabled: false, selfBuiltStatus: '未连接' })
            wx.setStorageSync('selfBuiltEnabled', false)
            wx.navigateTo({ url: '/pages/settings/self-built-config' })
          }
        })
        return
      }

      wx.showLoading({ title: '连接后端…' })
      db.initSelfBuilt(selfBuiltConfig)
      if (!db.isSelfBuiltReady()) {
        wx.hideLoading()
        wx.showModal({
          title: '连接失败',
          content: '无法初始化自建后端模式。\n\n请检查后端地址和 API 密钥是否正确配置。',
          showCancel: false
        })
        this.setData({ selfBuiltEnabled: false, selfBuiltStatus: '未连接' })
        wx.setStorageSync('selfBuiltEnabled', false)
        return
      }

      wx.hideLoading()
      wx.showToast({ title: '自建后端已连接', icon: 'success' })
      this.setData({ selfBuiltStatus: '已连接' })
      this._refreshAll()
    } else {
      wx.showToast({ title: '已切换为本地数据', icon: 'none' })
      this.setData({ selfBuiltStatus: '未连接' })
    }
  },

  // ========== 云数据库开关 ==========

  async onCloudDbToggle(e) {
    var enabled = e.detail.value
    this.setData({ cloudDbEnabled: enabled, cloudDbStatus: enabled ? '连接中…' : '未连接' })
    wx.setStorageSync('cloudDbEnabled', enabled)

    if (enabled) {
      db.initCloud()
      if (!db.isCloudReady()) {
        wx.showModal({
          title: '提示',
          content: '云开发初始化需要配置云环境 ID。\n\n请在 app.js 的 initCloud() 调用中设置正确的环境 ID，并确保已在微信开发者工具中开通云开发。',
          showCancel: false
        })
        this.setData({ cloudDbEnabled: false, cloudDbStatus: '未连接' })
        wx.setStorageSync('cloudDbEnabled', false)
        return
      }

      wx.showLoading({ title: '连接中…' })
      try {
        var checkRes = await wx.cloud.callFunction({ name: 'init', data: { action: 'check' } })
        if (checkRes.result && checkRes.result.code === 0 && !checkRes.result.data.initialized) {
          wx.showLoading({ title: '首次初始化…' })
          var setupRes = await wx.cloud.callFunction({ name: 'init', data: { action: 'setup' } })
          if (setupRes.result && setupRes.result.code === 0) {
            wx.hideLoading()
            wx.showToast({ title: '云数据库已初始化', icon: 'success' })
          }
        } else {
          wx.hideLoading()
          wx.showToast({ title: '云数据库已连接', icon: 'success' })
        }
        this.setData({ cloudDbStatus: '已连接' })
        this._refreshAll()
      } catch (err) {
        wx.hideLoading()
        console.error('[Settings] 云初始化失败:', err)
        wx.showModal({
          title: '连接失败',
          content: '无法连接到云开发环境。\n\n请确认：\n1. 已开通云开发\n2. 环境 ID 配置正确\n3. 云函数已部署\n\n错误信息：' + (err.message || '未知错误'),
          showCancel: false
        })
        this.setData({ cloudDbEnabled: false, cloudDbStatus: '未连接' })
        wx.setStorageSync('cloudDbEnabled', false)
      }
    } else {
      wx.showToast({ title: '已切换为本地数据', icon: 'none' })
      this.setData({ cloudDbStatus: '未连接' })
    }
  },

  // ========== 分级 TTL ==========

  onGradedTTLToggle(e) {
    var enabled = e.detail.value
    db.setGradedTTL(enabled)
    this.setData({ gradedTTL: enabled })

    wx.showToast({
      title: enabled ? '分级 TTL 已开启' : '分级 TTL 已关闭（缓存不会自动过期，可手动强制刷新）',
      icon: 'none'
    })
    this._refreshAll()
  },

  // ========== 同步所有数据 ==========

  async onSyncAllData() {
    var that = this

    var isCloud = db.isCloudReady()
    var isNAS = db.isNASReady()
    var isSelfBuilt = db.isSelfBuiltReady()
    if (!isCloud && !isNAS && !isSelfBuilt) {
      wx.showModal({
        title: '未连接后端',
        content: '请先在「数据存储」区域开启并连接云数据库、自建后端或 NAS 私有云。\n\n当前为本地 Mock 模式，无需同步。',
        showCancel: false
      })
      return
    }

    var modeName = isCloud ? '云数据库' : (isSelfBuilt ? '自建后端' : 'NAS 私有云')

    wx.showModal({
      title: '同步所有数据',
      content: '将从 ' + modeName + ' 全量拉取所有数据，包括：\n\n• 库存目录\n• 全部商品（每个仓库）\n• 出库单\n• 入库日志\n• 标签 / 状态编码 / 白名单\n\n这会清除本地缓存并重新下载，确认继续？',
      success: function (res) {
        if (res.confirm) {
          that._doSyncAllData(isCloud, isNAS, isSelfBuilt)
        }
      }
    })
  },

  async _doSyncAllData(isCloud, isNAS, isSelfBuilt) {
    var that = this

    this.setData({ syncing: true, syncProgress: '正在清除缓存…' })
    wx.showLoading({ title: '正在清除缓存…', mask: true })

    try {
      // 1. 清除所有缓存（包括差量同步标记和 L1/L2）
      await db.forceRefresh('all')

      // 2. 加载基础数据
      this.setData({ syncProgress: '正在同步库存目录…' })
      wx.showLoading({ title: '同步库存目录…', mask: true })
      await db.loadInventories(true)

      var invs = db.inventories
      var totalInvs = invs.length

      // 3. 对每个仓库，加载商品、出库单、入库日志
      for (var i = 0; i < totalInvs; i++) {
        var inv = invs[i]
        var invName = inv.name || ('仓库 ' + (i + 1))
        var idx = i + 1

        // 商品
        this.setData({ syncProgress: '同步商品 [' + idx + '/' + totalInvs + '] ' + invName })
        wx.showLoading({ title: '同步商品…', mask: true })
        await db.loadProducts(inv._id, true)

        // 出库单
        this.setData({ syncProgress: '同步出库单 [' + idx + '/' + totalInvs + '] ' + invName })
        wx.showLoading({ title: '同步出库单…', mask: true })
        await db.loadOutboundOrders(inv._id, true)

        // 入库日志
        this.setData({ syncProgress: '同步入库日志 [' + idx + '/' + totalInvs + '] ' + invName })
        wx.showLoading({ title: '同步入库日志…', mask: true })
        await db.loadInboundLogs(inv._id, true)
      }

      // 4. 加载标签、状态编码、白名单
      this.setData({ syncProgress: '正在同步标签…' })
      wx.showLoading({ title: '同步标签…', mask: true })
      await db.loadTags(true)

      this.setData({ syncProgress: '正在同步状态编码…' })
      wx.showLoading({ title: '同步状态编码…', mask: true })
      await db.loadStatusCodes(true)

      this.setData({ syncProgress: '正在同步白名单…' })
      wx.showLoading({ title: '同步白名单…', mask: true })
      await db.loadWhitelist(true)

      // 5. 记录同步时间与详情
      var now = new Date()
      var timeStr = now.getFullYear() + '-' +
        ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
        ('0' + now.getDate()).slice(-2) + ' ' +
        ('0' + now.getHours()).slice(-2) + ':' +
        ('0' + now.getMinutes()).slice(-2) + ':' +
        ('0' + now.getSeconds()).slice(-2)
      wx.setStorageSync('gs_last_full_sync', timeStr)

      // 统计
      var productCount = db.products.length
      var orderCount = db.outboundOrders.length
      var logCount = db.inboundLogs.length

      // 统计各仓库商品数
      var invDetails = invs.map(function(inv) {
        var prods = db.products.filter(function(p) { return p.inventory_id === inv._id })
        var orders = db.outboundOrders.filter(function(o) { return o.inventory_id === inv._id })
        var logs = db.inboundLogs.filter(function(l) { return l.inventory_id === inv._id })
        return {
          name: inv.name,
          productCount: prods.length,
          orderCount: orders.length,
          logCount: logs.length
        }
      })

      var syncDetail = {
        syncTime: timeStr,
        totalInventories: totalInvs,
        totalProducts: productCount,
        totalOrders: orderCount,
        totalLogs: logCount,
        tagCount: db.tags.length,
        statusCodeCount: db.statusCodes.length,
        whitelistCount: db.whitelist.length,
        invDetails: invDetails
      }
      wx.setStorageSync('gs_last_full_sync_detail', JSON.stringify(syncDetail))

      wx.hideLoading()

      this.setData({
        syncing: false,
        syncProgress: '',
        lastSyncTime: timeStr,
        lastSyncDetail: syncDetail
      })

      wx.showModal({
        title: '同步完成',
        content: '所有数据已从后端同步完成！\n\n' +
          '库存目录：' + totalInvs + ' 个\n' +
          '商品总数：' + productCount + ' 个\n' +
          '出库单：' + orderCount + ' 个\n' +
          '入库日志：' + logCount + ' 条\n' +
          '标签：' + db.tags.length + ' 个\n' +
          '状态编码：' + db.statusCodes.length + ' 个\n' +
          '白名单：' + db.whitelist.length + ' 人',
        showCancel: false
      })

      this._refreshAll()

    } catch (err) {
      wx.hideLoading()
      this.setData({ syncing: false, syncProgress: '' })
      console.error('[Settings] 同步失败:', err)
      wx.showModal({
        title: '同步失败',
        content: '错误信息：' + (err.message || '未知错误') + '\n\n请检查网络连接和后端服务状态后重试。',
        showCancel: false
      })
      this._refreshAll()
    }
  },

  // ========== 强制刷新缓存（仅清除本地缓存，不重新拉取） ==========

  onForceRefresh() {
    var that = this
    wx.showModal({
      title: '强制刷新缓存',
      content: '将清除所有本地缓存标记（L1 内存 + L2 Storage + 差量同步标记）。\n\n下次访问各页面时将自动从后端重新拉取数据。',
      success: function (res) {
        if (res.confirm) {
          db.forceRefresh('all')
          wx.showToast({ title: '缓存标记已清除', icon: 'success' })
          that._refreshAll()
        }
      }
    })
  },

  // ========== 缓存清理 ==========

  onClearAllCache() {
    var that = this
    wx.showModal({
      title: '清理所有缓存',
      content: '将清除所有本地数据缓存（L1内存 + L2 Storage + 差量同步标记）。\n\n下次使用时将重新从云数据库拉取，过程中会消耗云数据库读取次数。',
      success: function(res) {
        if (res.confirm) {
          db.clearAllCache()
          wx.showToast({ title: '缓存已全部清除', icon: 'success' })
          that._refreshAll()
        }
      }
    })
  },

  onClearStaleCache() {
    var that = this
    wx.showModal({
      title: '清理过期缓存',
      content: '仅清除已过期的缓存项，保留未过期的有效缓存。',
      success: function(res) {
        if (res.confirm) {
          db.clearStaleCache()
          wx.showToast({ title: '过期缓存已清理', icon: 'success' })
          that._refreshAll()
        }
      }
    })
  },

  // ========== 图片缓存 ==========

  onClearImageCache() {
    var that = this
    wx.showModal({
      title: '清理图片缓存',
      content: '将删除所有本地缓存的商品图片。\n\n下次浏览时图片将重新下载。',
      success: function(res) {
        if (res.confirm) {
          var result = imgCache.clearAllImages()
          wx.showToast({ title: '已清理 ' + result.removed + ' 张图片', icon: 'success' })
          that._refreshAll()
        }
      }
    })
  },

  onClearUnusedImages() {
    var that = this
    wx.showModal({
      title: '清理未使用图片',
      content: '将扫描所有已缓存图片，删除未被任何商品引用的冗余图片。',
      success: function(res) {
        if (!res.confirm) return

        wx.showLoading({ title: '扫描中…' })

        // 收集所有使用中的图片 URL
        var usedUrls = []
        db.products.forEach(function(p) {
          if (p.image_url) usedUrls.push(p.image_url)
        })
        // 出库单中的商品图片
        db.outboundOrders.forEach(function(o) {
          if (o.items) o.items.forEach(function(item) {
            if (item.image_url) usedUrls.push(item.image_url)
          })
        })
        // 入库日志中的商品图片
        db.inboundLogs.forEach(function(l) {
          if (l.items) l.items.forEach(function(item) {
            if (item.image_url) usedUrls.push(item.image_url)
          })
        })

        var result = imgCache.clearUnusedImages(usedUrls)
        wx.hideLoading()
        wx.showToast({
          title: '已移除 ' + result.removed + ' 张，保留 ' + result.kept + ' 张',
          icon: 'success'
        })
        that._refreshAll()
      }
    })
  },

  // ========== 查看上次全量同步详情 ==========

  onViewLastSyncDetail() {
    var detail = this.data.lastSyncDetail
    if (!detail) {
      // 如果没有存储详情，用当前数据作为兜底
      var invs = db.inventories
      var invDetails = invs.map(function(inv) {
        var prods = db.products.filter(function(p) { return p.inventory_id === inv._id })
        var orders = db.outboundOrders.filter(function(o) { return o.inventory_id === inv._id })
        var logs = db.inboundLogs.filter(function(l) { return l.inventory_id === inv._id })
        return {
          name: inv.name,
          productCount: prods.length,
          orderCount: orders.length,
          logCount: logs.length
        }
      })
      detail = {
        syncTime: this.data.lastSyncTime || '未知',
        totalInventories: invs.length,
        totalProducts: db.products.length,
        totalOrders: db.outboundOrders.length,
        totalLogs: db.inboundLogs.length,
        tagCount: db.tags.length,
        statusCodeCount: db.statusCodes.length,
        whitelistCount: db.whitelist.length,
        invDetails: invDetails
      }
    }
    this.setData({ syncDetailForShow: detail, showSyncDetail: true })
  },

  hideSyncDetail() {
    this.setData({ showSyncDetail: false })
  },

  onSyncDetailMaskTap() {
    this.hideSyncDetail()
  },

  // ========== 设置项显示控制 ==========

  onToggleSetting(e) {
    var key = e.currentTarget.dataset.key
    var value = e.detail.value
    this.setData({ [key]: value })
    var vis = {}
    try { vis = JSON.parse(wx.getStorageSync('settingsVisibility') || '{}') } catch(e) {}
    vis[key] = value
    wx.setStorageSync('settingsVisibility', JSON.stringify(vis))
  },
})
