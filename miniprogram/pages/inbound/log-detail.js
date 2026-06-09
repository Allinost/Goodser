const mockData = require('../../utils/mock-data')

const TYPE_MAP = { single: '单独新增入库', batch: '批量新增入库', search: '搜索导入入库' }

Page({
  data: {
    log: {},
    logTypeLabel: '',
    inventoryName: '',
    totalQuantity: 0
  },

  onLoad(options) {
    this._logId = options.id
    this.loadLog()
  },

  loadLog() {
    const log = mockData.inboundLogs.find(l => l._id === this._logId)
    if (!log) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    const totalQuantity = log.items.reduce((sum, item) => sum + item.quantity, 0)
    const inv = mockData.inventories.find(i => i._id === log.inventory_id)
    this.setData({
      log,
      logTypeLabel: TYPE_MAP[log.type] || log.type,
      inventoryName: inv ? inv.name : '',
      totalQuantity
    })
    wx.setNavigationBarTitle({ title: '入库单详情' })
  },

  onEdit() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除入库记录后，对应商品库存将回退。确定删除吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 从 mock 数据中移除
          const idx = mockData.inboundLogs.findIndex(l => l._id === this._logId)
          if (idx > -1) {
            mockData.inboundLogs.splice(idx, 1)
          }
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
