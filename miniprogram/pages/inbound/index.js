const mockData = require('../../utils/mock-data')

// WXML 不支持三元表达式和数组方法，在此处预处理
const TYPE_MAP = { single: '📝 单独新增', batch: '📋 批量新增', search: '🔍 搜索导入' }

function formatLog(log) {
  const productNames = log.items.map(i => i.product_name).join('、')
  const totalQty = log.items.reduce((s, i) => s + i.quantity, 0)
  return {
    ...log,
    _typeLabel: TYPE_MAP[log.type] || log.type,
    _productNames: productNames,
    _totalQty: totalQty
  }
}

Page({
  data: {
    inboundLogs: []
  },

  onShow() {
    const logs = mockData.inboundLogs
      .filter(l => l.inventory_id === 'inv_001')
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
