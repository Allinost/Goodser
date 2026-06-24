Page({
  data: {
    connected: false,
    configBaseUrl: '',
    preset: 'public',
    backendAddress: 'bak.hailong.site:8080',
    apiKey: ''
  },

  onSelectPreset(e) {
    var preset = e.currentTarget.dataset.preset
    var address = ''
    if (preset === 'public') {
      address = 'bak.hailong.site:8080'
    } else if (preset === 'easytier') {
      address = '10.144.144.14:8080'
    } else {
      address = ''
    }
    this.setData({
      preset: preset,
      backendAddress: address
    })
  },

  onAddressInput(e) {
    this.setData({ backendAddress: e.detail.value, preset: 'custom' })
  },

  onApiKeyInput(e) { this.setData({ apiKey: e.detail.value }) },

  onTestConnection() {
    if (!this.data.backendAddress) {
      wx.showToast({ title: '请输入后端地址', icon: 'none' })
      return
    }

    var baseUrl = this.data.backendAddress.replace(/\/+$/, '')
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'http://' + baseUrl
    }

    wx.showLoading({ title: '测试连接中…' })
    wx.request({
      url: baseUrl.replace(/\/+$/, '') + '/api/loadStatusCodes',
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (this.data.apiKey || '')
      },
      data: {},
      timeout: 10000,
      success: (res) => {
        wx.hideLoading()
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          this.setData({ connected: true, configBaseUrl: baseUrl })
          wx.showToast({ title: '连接成功', icon: 'success' })
        } else {
          wx.showModal({
            title: '连接失败',
            content: '后端返回错误: ' + ((res.data && res.data.message) || '状态码 ' + res.statusCode),
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ connected: false })
        wx.showModal({
          title: '连接失败',
          content: '无法连接到后端，请检查地址和网络。\n\n错误: ' + (err.errMsg || '未知错误'),
          showCancel: false
        })
      }
    })
  },

  onSave() {
    if (!this.data.backendAddress) {
      wx.showToast({ title: '请输入后端地址', icon: 'none' })
      return
    }

    var baseUrl = this.data.backendAddress.replace(/\/+$/, '')
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = 'http://' + baseUrl
    }

    var config = {
      baseUrl: baseUrl,
      apiKey: this.data.apiKey
    }
    wx.setStorageSync('selfBuiltConfig', JSON.stringify(config))
    wx.showToast({ title: '配置已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  },

  onLoad() {
    try {
      var raw = wx.getStorageSync('selfBuiltConfig')
      if (raw) {
        var config = JSON.parse(raw)
        var address = (config.baseUrl || '').replace(/^https?:\/\//, '')
        var preset = 'custom'
        if (address === 'bak.hailong.site:8080') preset = 'public'
        else if (address === '10.144.144.14:8080') preset = 'easytier'
        this.setData({
          backendAddress: address,
          apiKey: config.apiKey || '',
          preset: preset
        })
      }
    } catch (e) {}
  }
})
