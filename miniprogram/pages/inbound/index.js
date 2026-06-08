const mockData = require('../../utils/mock-data')

Page({
  data: {
    inboundLogs: []
  },

  onShow() {
    const logs = mockData.inboundLogs.filter(l => l.inventory_id === 'inv_001')
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
  }
})
