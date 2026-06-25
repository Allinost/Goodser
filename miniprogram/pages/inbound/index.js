const db = require('../../utils/db')
const util = require('../../utils/util')

// WXML 不支持三元表达式和数组方法，在此处预处理
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
    inboundLogs: []
  },

  onLoad() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const index = inventories.length > 0 ? 0 : 0
    const currentInventoryId = inventories.length > 0 ? inventories[0]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId: currentInventoryId,
      inventoryIndex: index
    })
  },

  async onShow() {
    // 刷新库存目录列表（可能从库存页面新增/删除/重命名了目录）
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    // 确保当前目录索引仍然有效
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories: inventories,
      inventoryNames: inventoryNames,
      inventoryIndex: index,
      currentInventoryId: currentInventoryId
    })
    await this.loadLogs()
  },

  async onPullDownRefresh() {
    // 刷新库存目录列表
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories: inventories,
      inventoryNames: inventoryNames,
      inventoryIndex: index,
      currentInventoryId: currentInventoryId
    })
    await this.loadLogs()
    wx.stopPullDownRefresh()
  },

  onInventoryChange(e) {
    const index = e.detail.value
    this.setData({
      inventoryIndex: index,
      currentInventoryId: this.data.inventories[index]._id
    })
    this.loadLogs()
  },

  async loadLogs() {
    if (db.isBackendMode && db.isBackendMode()) {
      try {
        await db.loadInboundLogs(this.data.currentInventoryId, true)
      } catch (e) {
        console.warn('[入库日志] 后端刷新失败，使用本地缓存:', e)
      }
    }
    const logs = db.inboundLogs
      .filter(l => l.inventory_id === this.data.currentInventoryId)
      .map(formatLog)
    this.setData({ inboundLogs: logs })
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
