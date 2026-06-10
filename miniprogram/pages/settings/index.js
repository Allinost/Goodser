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

    // 缓存管理
    gradedTTL: false,
    cacheL1Count: 0,
    cacheStorageCount: 0,
    cacheStorageKB: '0',

    // 差量同步
    syncInfo: [],

    // 图片缓存
    imageCacheCount: 0,
    imageCacheKB: '0'
  },

  onShow() {
    this._refreshAll()
  },

  _refreshAll() {
    var enabled = wx.getStorageSync('cloudDbEnabled') || false
    var statusText = enabled
      ? (db.isCloudReady() ? '已连接' : '连接中…')
      : '未连接'

    var cacheStats = db.getCacheStats()
    var syncInfo = db.getSyncInfo()
    var imgStats = imgCache.getImageStats()

    this.setData({
      whitelistCount: db.whitelist.length,
      statusCodeCount: db.statusCodes.length,
      tagCount: db.tags.length,
      nasConnected: false,
      cloudDbEnabled: enabled,
      cloudDbStatus: statusText,
      gradedTTL: cacheStats.gradedTTL,
      cacheL1Count: cacheStats.l1Count,
      cacheStorageCount: cacheStats.storageCount,
      cacheStorageKB: cacheStats.storageKB.toFixed(1),
      syncInfo: syncInfo,
      imageCacheCount: imgStats.count,
      imageCacheKB: imgStats.totalKB.toFixed(1)
    })
  },

  // ========== 导航 ==========

  onWhitelist() { wx.navigateTo({ url: '/pages/settings/whitelist' }) },
  onStatusCodes() { wx.navigateTo({ url: '/pages/settings/status-codes' }) },
  onTags() { wx.navigateTo({ url: '/pages/settings/tags' }) },
  onNasConfig() { wx.navigateTo({ url: '/pages/settings/nas-config' }) },

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
      title: enabled ? '分级 TTL 已开启' : '分级 TTL 已关闭（缓存永不过期）',
      icon: 'none'
    })
    this._refreshAll()
  },

  // ========== 强制刷新 ==========

  async onForceRefresh() {
    if (!db.isCloudReady()) {
      wx.showToast({ title: '云数据库未连接', icon: 'none' })
      return
    }

    wx.showLoading({ title: '强制刷新中…' })
    try {
      await db.forceRefresh('all')
      // 重新加载核心数据
      await db.loadInventories(true)
      await db.loadTags(true)
      await db.loadStatusCodes(true)
      await db.loadWhitelist(true)

      wx.hideLoading()
      wx.showToast({ title: '全部数据已刷新', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '刷新失败: ' + (err.message || '未知'), icon: 'none' })
    }

    this._refreshAll()
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
  }
})
