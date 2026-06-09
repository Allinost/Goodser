const mockData = require('../../utils/mock-data')

Page({
  data: {
    whitelistCount: 0,
    statusCodeCount: 0,
    tagCount: 0,
    nasConnected: false,
    cloudDbEnabled: false
  },

  onShow() {
    this.setData({
      whitelistCount: mockData.whitelist.length,
      statusCodeCount: mockData.statusCodes.length,
      tagCount: mockData.tags.length,
      nasConnected: false,
      cloudDbEnabled: wx.getStorageSync('cloudDbEnabled') || false
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
  },

  onCloudDbToggle(e) {
    const enabled = e.detail.value
    this.setData({ cloudDbEnabled: enabled })
    wx.setStorageSync('cloudDbEnabled', enabled)
    if (enabled) {
      wx.showToast({ title: '云数据库已启用（待接入）', icon: 'none' })
    } else {
      wx.showToast({ title: '已切换为本地数据', icon: 'none' })
    }
  }
})
