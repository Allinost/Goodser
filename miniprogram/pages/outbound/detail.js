const db = require('../../utils/db')
const util = require('../../utils/util')

Page({
  data: {
    order: {},
    statusLabel: '',
    statusTagClass: '',
    totalQuantity: 0
  },

  onLoad(options) {
    this._orderId = options.id
    this.loadOrder()
  },

  loadOrder() {
    const order = db.outboundOrders.find(o => o._id === this._orderId)
    if (order) {
      const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
      this.setData({
        order: {
          ...order,
          _createdAt: util.formatTime(order.created_at),
          _updatedAt: util.formatTime(order.updated_at),
          _convertedAt: util.formatTime(order.converted_at),
          _confirmedAt: util.formatTime(order.confirmed_at),
          _cancelledAt: util.formatTime(order.cancelled_at)
        },
        statusLabel: util.getOrderStatusLabel(order.status),
        statusTagClass: util.getOrderStatusTagClass(order.status),
        totalQuantity
      })
      wx.setNavigationBarTitle({
        title: order.type === 'outbound' ? '出库单详情' : '预留单详情'
      })
    }
  },

  // 点击商品跳转详情
  onProductTap(e) {
    var productId = e.currentTarget.dataset.id
    if (!productId) return
    var order = db.outboundOrders.find(function(o) { return o._id === this._orderId }.bind(this))
    var invId = order ? order.inventory_id : ''
    wx.navigateTo({ url: '/pages/inventory/detail?id=' + productId + '&inv_id=' + invId })
  },

  onShow() {
    if (this._orderId) this.loadOrder()
  },

  onCancel() {
    const order = this.data.order
    const action = order.type === 'outbound' ? '取消出库' : '取消预留'
    wx.showModal({
      title: `确认${action}`,
      content: `${action}后库存将恢复，确定继续吗？`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true })
          try {
            // 通过 API 取消（后端恢复库存 + 更新状态）
            if (order.type === 'outbound') {
              await db.cancelOutbound(order._id)
            } else {
              await db.cancelReserve(order._id)
            }
            wx.hideLoading()
            wx.showToast({ title: `${action}成功`, icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } catch (err) {
            wx.hideLoading()
            console.error('[出库] 取消失败:', err)
            wx.showToast({ title: `${action}失败: ` + (err.message || '未知错误'), icon: 'none', duration: 2500 })
          }
        }
      }
    })
  },

  onConfirm() {
    const order = this.data.order
    const isOutbound = order.type === 'outbound'
    const action = isOutbound ? '确认出库' : '转出库'
    wx.showModal({
      title: `确认${action}`,
      content: isOutbound
        ? '确认出库后将释放锁定库存并归档此出库单，确定继续吗？'
        : '转出库后会生成待出库单，库存仍保持锁定；确认出库时才真正扣减总量。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true })
          try {
            if (isOutbound) {
              await db.confirmOutbound(order._id)
            } else {
              await db.reserveToOutbound(order._id, {
                inventory_id: order.inventory_id,
                order_info: order.order_info || '',
                remark: order.remark || ''
              })
            }
            wx.hideLoading()
            wx.showToast({ title: `${action}成功`, icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } catch (err) {
            wx.hideLoading()
            console.error('[出库] 确认失败:', err)
            wx.showToast({ title: `${action}失败: ` + (err.message || '未知错误'), icon: 'none', duration: 2500 })
          }
        }
      }
    })
  }
})
