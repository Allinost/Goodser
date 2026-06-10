const db = require('./utils/db')

App({
  onLaunch() {
    console.log('Goodser 库存管理启动')

    // 检测云数据库开关（云模式优先于 NAS 模式）
    if (db.isCloudEnabled()) {
      console.log('[App] 云数据库模式已启用，正在初始化...')
      db.initCloud()  // 使用 project.config.json 中配置的云环境

      // 检查是否已初始化（有网络时异步检查）
      this.checkCloudInit()
    } else if (db.isNASEnabled()) {
      console.log('[App] NAS 私有云模式已启用，正在初始化...')
      // 读取 NAS 配置
      var nasConfig = {}
      try {
        var raw = wx.getStorageSync('nasConfig')
        if (raw) nasConfig = JSON.parse(raw)
      } catch (e) {
        nasConfig = {}
      }
      if (nasConfig.baseUrl) {
        db.initNAS(nasConfig)
      } else {
        console.warn('[App] NAS 模式已启用但未配置地址，回退到 Mock 模式')
      }
    } else {
      console.log('[App] 使用本地 Mock 数据模式')
    }
  },

  /**
   * 检查云开发是否已初始化（状态编码等种子数据）
   */
  async checkCloudInit() {
    if (!db.isCloudReady()) return
    try {
      const res = await wx.cloud.callFunction({
        name: 'init',
        data: { action: 'check' }
      })
      if (res.result && res.result.code === 0 && !res.result.data.initialized) {
        console.log('[App] 云数据库未初始化，正在设置种子数据...')
        // 自动初始化
        const setupRes = await wx.cloud.callFunction({
          name: 'init',
          data: { action: 'setup' }
        })
        console.log('[App] 初始化结果:', setupRes.result)
      }
    } catch (err) {
      console.warn('[App] 云初始化检查失败（可能是首次使用或网络问题）:', err.message)
    }
  },

  globalData: {
    currentInventoryId: 'inv_001',
    userInfo: null
  }
})
