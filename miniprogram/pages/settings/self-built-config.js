Page({
  data: {
    connected: false,
    configBaseUrl: '',
    preset: 'public',
    backendAddress: 'https://test.hailong.site:8408',
    apiKey: ''
  },

  onSelectPreset(e) {
    var preset = e.currentTarget.dataset.preset
    var address = ''
    if (preset === 'public') {
      address = 'test.hailong.site:8408'
    } else if (preset === 'easytier') {
      address = 'et.hailong.site:8080'
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

  _makeUrl(raw) {
    var url = raw.replace(/\/+$/, '')
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    return url
  },

  onTestConnection() {
    if (!this.data.backendAddress) {
      wx.showToast({ title: '请输入后端地址', icon: 'none' })
      return
    }

    var baseUrl = this._makeUrl(this.data.backendAddress)
    var useHttps = baseUrl.startsWith('https://')

    wx.showLoading({ title: '测试连接中…' })
    var that = this
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
          that.setData({ connected: true, configBaseUrl: baseUrl })
          wx.showToast({ title: '连接成功', icon: 'success' })
        } else {
          var msg = (res.data && res.data.message) || ('状态码 ' + res.statusCode)
          wx.showModal({
            title: '连接失败',
            content: '后端返回错误: ' + msg + '\n\n请确认后端服务已启动且 API 密钥正确。',
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        that.setData({ connected: false })
        var errMsg = err.errMsg || ''
        var tips = ''
        if (errMsg.indexOf('fail') !== -1 || errMsg.indexOf('timeout') !== -1) {
          tips = '请检查：\n1. 后端服务是否已启动\n2. 地址和端口是否正确\n3. 网络是否可达（公网 / EasyTier 已连接）\n'
        }
        if (!useHttps && errMsg.indexOf('request:fail') !== -1) {
          tips += '4. 微信开发者工具中需开启「不校验合法域名」\n'
          tips += '5. 真机预览必须使用 HTTPS'
        }
        wx.showModal({
          title: '连接失败',
          content: tips + '\n错误: ' + errMsg,
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

    var baseUrl = this._makeUrl(this.data.backendAddress)
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
        if (address === 'test.hailong.site:8408') preset = 'public'
        else if (address === 'et.hailong.site:8080') preset = 'easytier'
        this.setData({
          backendAddress: address,
          apiKey: config.apiKey || '',
          preset: preset
        })
      }
    } catch (e) {}
  }
})
