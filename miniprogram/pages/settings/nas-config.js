Page({
  data: {
    connected: false,
    vpnTypes: ['Tailscale', 'ZeroTier', 'frp 内网穿透', '直连'],
    vpnTypeIndex: 0,
    nasAddress: '',
    nasPort: '5000',
    nasPath: '/goodser/images/',
    nasApiKey: '',
    autoSync: true,
    cleanAfterSync: false
  },

  onVpnTypeChange(e) {
    this.setData({ vpnTypeIndex: e.detail.value })
  },

  onAddressInput(e) { this.setData({ nasAddress: e.detail.value }) },
  onPortInput(e) { this.setData({ nasPort: e.detail.value }) },
  onPathInput(e) { this.setData({ nasPath: e.detail.value }) },
  onApiKeyInput(e) { this.setData({ nasApiKey: e.detail.value }) },

  onAutoSyncChange(e) { this.setData({ autoSync: e.detail.value }) },
  onCleanAfterSyncChange(e) { this.setData({ cleanAfterSync: e.detail.value }) },

  onTestConnection() {
    if (!this.data.nasAddress) {
      wx.showToast({ title: '请输入 NAS 地址', icon: 'none' })
      return
    }
    wx.showLoading({ title: '测试连接中...' })
    setTimeout(() => {
      this.setData({ connected: false })
      wx.hideLoading()
      wx.showModal({
        title: '连接失败',
        content: '无法连接到 NAS，请检查地址和组网配置',
        showCancel: false
      })
    }, 1500)
  },

  onSave() {
    wx.showToast({ title: '配置已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  }
})
