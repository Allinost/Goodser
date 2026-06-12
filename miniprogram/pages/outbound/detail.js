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
        order,
        statusLabel: util.getOrderStatusLabel(order.status),
        statusTagClass: util.getOrderStatusTagClass(order.status),
        totalQuantity
      })
      wx.setNavigationBarTitle({
        title: order.type === 'outbound' ? '出库单详情' : '预留单详情'
      })
    }
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
    const action = isOutbound ? '确认出库' : '准备出库'
    wx.showModal({
      title: `确认${action}`,
      content: isOutbound ? '确认出库后将扣减库存并归档此出库单' : '准备出库后将生成对应的出库单并扣减库存',
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
                remark: order.remark || '',
                items: order.items || []
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
  },

  // 出库创建时扣减库存
  _deductQuantity(order) {
    order.items.forEach(item => {
      const product = db.products.find(p => p._id === item.product_id)
      if (product) {
        product.quantity = Math.max(0, product.quantity - item.quantity)
        product.updated_at = new Date().toLocaleString()
      }
    })
  },

  // 出库取消时恢复库存
  _restoreQuantity(order) {
    order.items.forEach(item => {
      const product = db.products.find(p => p._id === item.product_id)
      if (product) {
        product.quantity += item.quantity
        product.updated_at = new Date().toLocaleString()
      }
    })
  },

  // 预留时锁定库存（增加 reserved_quantity，减少可用 quantity）
  _lockReserved(order) {
    order.items.forEach(item => {
      const product = db.products.find(p => p._id === item.product_id)
      if (product) {
        product.reserved_quantity = (product.reserved_quantity || 0) + item.quantity
        product.updated_at = new Date().toLocaleString()
      }
    })
  },

  // 取消预留时恢复
  _restoreReserved(order) {
    order.items.forEach(item => {
      const product = db.products.find(p => p._id === item.product_id)
      if (product) {
        product.reserved_quantity = Math.max(0, (product.reserved_quantity || 0) - item.quantity)
        product.updated_at = new Date().toLocaleString()
      }
    })
  },

  // 预留单转出库：先释放预留，再扣减实际库存
  _convertReserveToOutbound(order) {
    const mockOrder = db.outboundOrders.find(o => o._id === order._id)
    if (mockOrder) {
      // 释放预留
      order.items.forEach(item => {
        const product = db.products.find(p => p._id === item.product_id)
        if (product) {
          product.reserved_quantity = Math.max(0, (product.reserved_quantity || 0) - item.quantity)
          product.quantity = Math.max(0, product.quantity - item.quantity)
          product.updated_at = new Date().toLocaleString()
        }
      })
      mockOrder.type = 'outbound'
      mockOrder.status = 'confirmed'
      mockOrder.confirmed_at = new Date().toLocaleString()
      mockOrder.updated_at = new Date().toLocaleString()
    }
  }
})
