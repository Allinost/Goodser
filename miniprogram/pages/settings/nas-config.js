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
    // 保存 NAS 配置到 Storage
    var config = {
      baseUrl: this.data.nasAddress.replace(/\/+$/, '') + ':' + this.data.nasPort,
      apiKey: this.data.nasApiKey,
      nasPath: this.data.nasPath,
      autoSync: this.data.autoSync,
      cleanAfterSync: this.data.cleanAfterSync,
      vpnType: this.data.vpnTypes[this.data.vpnTypeIndex]
    }
    wx.setStorageSync('nasConfig', JSON.stringify(config))
    wx.showToast({ title: '配置已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  },

  onLoad() {
    // 恢复已保存的配置
    try {
      var raw = wx.getStorageSync('nasConfig')
      if (raw) {
        var config = JSON.parse(raw)
        // 从 baseUrl 解析地址和端口
        var urlMatch = (config.baseUrl || '').match(/^(.+?):(\d+)$/)
        if (urlMatch) {
          this.setData({
            nasAddress: urlMatch[1] || '',
            nasPort: urlMatch[2] || '5000',
            nasApiKey: config.apiKey || '',
            nasPath: config.nasPath || '/goodser/images/',
            autoSync: config.autoSync !== false,
            cleanAfterSync: config.cleanAfterSync === true
          })
        } else {
          this.setData({
            nasAddress: config.baseUrl || '',
            nasApiKey: config.apiKey || ''
          })
        }
      }
    } catch (e) {}
  }
})
