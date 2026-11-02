const db = require('../../utils/db')
const util = require('../../utils/util')

const REASON_LABELS = {
  refund_only: '仅退款',
  return_refund: '退货退款',
  shipping_damage: '运损',
  other: '其他'
}
const RETURN_STATUS_LABELS = { pending: '待确认', confirmed: '已确认', cancelled: '已取消' }
const RETURN_STATUS_CLASSES = { pending: 'tag-orange', confirmed: 'tag-green', cancelled: 'tag-gray' }

Page({
  data: {
    order: {},
    statusLabel: '',
    statusTagClass: '',
    totalQuantity: 0,
    canReturn: false,
    returns: [],
    loadingReturns: false
  },

  onLoad(options) {
    this._orderId = options.id
    this._inventoryId = options.inv_id || ''
    this.loadOrder()
  },

  async loadOrder() {
    let order = null
    if (this._inventoryId && db.isBackendMode && db.isBackendMode()) {
      try {
        const result = await db.loadOutboundOrders(this._inventoryId, true)
        order = (result.items || []).find(o => o._id === this._orderId)
      } catch (e) {}
    }
    if (!order) {
      order = db.outboundOrders.find(o => o._id === this._orderId)
    }
    if (!order) return
    this._inventoryId = order.inventory_id || this._inventoryId
    const items = order.items || []
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
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
      canReturn: order.type === 'outbound' && (order.status === 'confirmed' || order.status === 'partially_returned'),
      totalQuantity
    })
    wx.setNavigationBarTitle({
      title: order.type === 'outbound' ? '出库单详情' : '预留单详情'
    })
    this.loadReturns()
  },

  async loadReturns() {
    if (!this._inventoryId || !this._orderId) return
    this.setData({ loadingReturns: true })
    try {
      const list = await db.loadReturns(this._inventoryId, this._orderId, true)
      this.setData({
        returns: (list || []).map(ret => ({
          ...ret,
          _reasonLabel: REASON_LABELS[ret.reason] || ret.reason,
          _statusLabel: RETURN_STATUS_LABELS[ret.status] || ret.status,
          _statusClass: RETURN_STATUS_CLASSES[ret.status] || 'tag-gray',
          _createdAt: util.formatTime(ret.created_at)
        }))
      })
    } catch (e) {
      console.error('[退货] 加载退货记录失败:', e)
    } finally {
      this.setData({ loadingReturns: false })
    }
  },

  onCreateReturn() {
    if (!this.data.canReturn) return
    wx.navigateTo({
      url: `/pages/returns/create?inventory_id=${this._inventoryId}&order_id=${this._orderId}`
    })
  },

  onConfirmReturn(e) {
    const ret = e.currentTarget.dataset.ret
    if (!ret) return
    wx.showModal({
      title: '确认退货',
      content: '确认后将按「回库」设置恢复可售库存，确定继续吗？',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await db.confirmReturn(this._inventoryId, ret._id)
          wx.hideLoading()
          wx.showToast({ title: '退货已确认', icon: 'success' })
          await this.loadOrder()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '确认失败', icon: 'none', duration: 2500 })
        }
      }
    })
  },

  onCancelReturn(e) {
    const ret = e.currentTarget.dataset.ret
    if (!ret) return
    wx.showModal({
      title: '取消退货单',
      content: '取消后该退货单不再生效，确定继续吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await db.cancelReturn(this._inventoryId, ret._id)
          wx.hideLoading()
          wx.showToast({ title: '已取消', icon: 'success' })
          await this.loadReturns()
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '取消失败', icon: 'none', duration: 2500 })
        }
      }
    })
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
