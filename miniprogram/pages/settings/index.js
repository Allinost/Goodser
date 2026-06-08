const mockData = require('../../utils/mock-data')

Page({
  data: {
    whitelistCount: 0,
    statusCodeCount: 0,
    nasConnected: false
  },

  onShow() {
    this.setData({
      whitelistCount: mockData.whitelist.length,
      statusCodeCount: mockData.statusCodes.length,
      nasConnected: false // Mock: NAS 未连接
    })
  },

  onWhitelist() {
    wx.navigateTo({ url: '/pages/settings/whitelist' })
  },

  onStatusCodes() {
    wx.navigateTo({ url: '/pages/settings/status-codes' })
  },

  onNasConfig() {
    wx.navigateTo({ url: '/pages/settings/nas-config' })
  }
})
