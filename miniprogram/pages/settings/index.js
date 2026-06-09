const mockData = require('../../utils/mock-data')

Page({
  data: {
    whitelistCount: 0,
    statusCodeCount: 0,
    tagCount: 0,
    nasConnected: false
  },

  onShow() {
    this.setData({
      whitelistCount: mockData.whitelist.length,
      statusCodeCount: mockData.statusCodes.length,
      tagCount: mockData.tags.length,
      nasConnected: false
    })
  },

  onWhitelist() {
    wx.navigateTo({ url: '/pages/settings/whitelist' })
  },

  onStatusCodes() {
    wx.navigateTo({ url: '/pages/settings/status-codes' })
  },

  onTags() {
    wx.navigateTo({ url: '/pages/settings/tags' })
  },

  onNasConfig() {
    wx.navigateTo({ url: '/pages/settings/nas-config' })
  }
})
