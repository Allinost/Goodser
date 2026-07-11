const db = require('../../utils/db')
const util = require('../../utils/util')

const TYPE_MAP = { single: '📝 单独新增', batch: '📋 批量新增', search: '🔍 搜索导入' }

function formatLog(log) {
  const productNames = log.items.map(i => i.product_name).join('、')
  const totalQty = log.items.reduce((s, i) => s + i.quantity, 0)
  return {
    ...log,
    _typeLabel: TYPE_MAP[log.type] || log.type,
    _productNames: productNames,
    _totalQty: totalQty,
    _createdAt: util.formatTime(log.created_at)
  }
}

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    currentInventoryId: '',
    inboundLogs: [],
    page: 1,
    pageSize: 20,
    hasMore: false,
    loadingMore: false
  },

  onLoad() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const currentInventoryId = inventories.length > 0 ? inventories[0]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId,
      inventoryIndex: 0
    })
    this.refreshData()
  },

  onShow() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      inventoryIndex: index,
      currentInventoryId
    })
    this.refreshData()
  },

  async onPullDownRefresh() {
    await this.refreshData()
    wx.stopPullDownRefresh()
  },

  async refreshData() {
    if (db.isBackendMode && db.isBackendMode()) {
      await db.loadInventories(true)
    }
    var invs = db.inventories
    var curId = this.data.currentInventoryId
    if (!curId && invs.length > 0) curId = invs[0]._id
    this.setData({ inventories: invs, currentInventoryId: curId, inboundLogs: [], page: 1, hasMore: false })
    await this.loadPage(1, true)
  },

  async loadPage(pageNum, forceRefresh) {
    const invId = this.data.currentInventoryId
    if (!invId) return
    if (db.isBackendMode && db.isBackendMode()) {
      var opts = forceRefresh ? true : { page: pageNum, page_size: this.data.pageSize }
      var result = await db.loadInboundLogs(invId, opts)
      var formatted = (result.items || []).map(formatLog)
      if (pageNum === 1) {
        this.setData({ inboundLogs: formatted, hasMore: result.has_more, page: 1 })
      } else {
        this.setData({
          inboundLogs: [...this.data.inboundLogs, ...formatted],
          hasMore: result.has_more,
          page: pageNum
        })
      }
    } else {
      this.loadLogs()
    }
  },

  loadLogs() {
    const logs = db.inboundLogs
      .filter(l => l.inventory_id === this.data.currentInventoryId)
      .map(formatLog)
    this.setData({ inboundLogs: logs })
  },

  async onReachBottom() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    await this.loadPage(this.data.page + 1)
    this.setData({ loadingMore: false })
  },

  onInventoryChange(e) {
    const index = e.detail.value
    this.setData({
      inventoryIndex: index,
      currentInventoryId: this.data.inventories[index]._id
    })
    this.refreshData()
  },

  onSingleInbound() {
    wx.navigateTo({ url: '/pages/inbound/single' })
  },

  onBatchInbound() {
    wx.navigateTo({ url: '/pages/inbound/batch' })
  },

  onSearchImport() {
    wx.navigateTo({ url: '/pages/inbound/search-import' })
  },

  onLogTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/inbound/log-detail?id=${id}` })
  }
})
