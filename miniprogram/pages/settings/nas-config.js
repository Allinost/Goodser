var db = require('../../utils/db')

Page({
  data: {
    connected: false,
    connecting: false,
    backendAddress: '',
    backendPort: '29092',
    username: '',
    password: '',
    nasPath: '/goodser/images/',
    autoSync: true,
    cleanAfterSync: false
  },

  onAddressInput(e) { this.setData({ backendAddress: e.detail.value }) },
  onPortInput(e) { this.setData({ backendPort: e.detail.value }) },
  onUsernameInput(e) { this.setData({ username: e.detail.value }) },
  onPasswordInput(e) { this.setData({ password: e.detail.value }) },

  onAutoSyncChange(e) { this.setData({ autoSync: e.detail.value }) },
  onCleanAfterSyncChange(e) { this.setData({ cleanAfterSync: e.detail.value }) },

  async onTestConnection() {
    if (!this.data.backendAddress) {
      wx.showToast({ title: '请输入后端地址', icon: 'none' })
      return
    }
    if (!this.data.username || !this.data.password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }

    this.setData({ connecting: true })
    wx.showLoading({ title: '登录验证中...' })

    try {
      var tokenData = await db.loginGoBackend({
        address: this.data.backendAddress,
        port: this.data.backendPort,
        username: this.data.username,
        password: this.data.password
      })
      wx.hideLoading()
      this.setData({ connecting: false, connected: true })
      wx.showToast({ title: '连接成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      this.setData({ connecting: false, connected: false })
      wx.showModal({
        title: '连接失败',
        content: '无法登录到后端服务：' + (err.message || '未知错误'),
        showCancel: false
      })
    }
  },

  async onSave() {
    if (!this.data.backendAddress) {
      wx.showToast({ title: '请输入后端地址', icon: 'none' })
      return
    }
    if (!this.data.username || !this.data.password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存配置...' })

    try {
      // 登录获取 token
      var tokenData = await db.loginGoBackend({
        address: this.data.backendAddress,
        port: this.data.backendPort,
        username: this.data.username,
        password: this.data.password
      })

      // 保存配置到 Storage
      var config = {
        baseUrl: 'http://' + this.data.backendAddress.replace(/\/+$/, '') + ':' + this.data.backendPort,
        backendAddress: this.data.backendAddress,
        backendPort: this.data.backendPort,
        username: this.data.username,
        password: this.data.password,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresIn: tokenData.expires_in,
        nasPath: this.data.nasPath,
        autoSync: this.data.autoSync,
        cleanAfterSync: this.data.cleanAfterSync
      }
      wx.setStorageSync('nasConfig', JSON.stringify(config))

      // 初始化 NAS 模式
      db.initNAS(config)

      wx.hideLoading()
      wx.showToast({ title: '配置已保存并连接', icon: 'success' })
      this.setData({ connected: true })
      setTimeout(() => wx.navigateBack(), 1500)
    } catch (err) {
      wx.hideLoading()
      wx.showModal({
        title: '保存失败',
        content: '无法登录后端服务：' + (err.message || '未知错误'),
        showCancel: false
      })
    }
  },

  onLoad() {
    try {
      var raw = wx.getStorageSync('nasConfig')
      if (raw) {
        var config = JSON.parse(raw)
        this.setData({
          backendAddress: config.backendAddress || '',
          backendPort: config.backendPort || '29092',
          username: config.username || '',
          password: config.password || '',
          nasPath: config.nasPath || '/goodser/images/',
          autoSync: config.autoSync !== false,
          cleanAfterSync: config.cleanAfterSync === true,
          connected: !!(config.accessToken)
        })
      }
    } catch (e) {}
  }
})
