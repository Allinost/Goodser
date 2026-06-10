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
      success: (res) => {
        if (res.confirm) {
          // 恢复库存
          if (order.type === 'outbound') {
            // 出库单取消：恢复实际库存
            this._restoreQuantity(order)
          } else {
            // 预留单取消：恢复预留库存
            this._restoreReserved(order)
          }
          // 更新订单状态
          const mockOrder = db.outboundOrders.find(o => o._id === order._id)
          if (mockOrder) {
            mockOrder.status = 'cancelled'
            mockOrder.cancelled_at = new Date().toLocaleString()
            mockOrder.updated_at = new Date().toLocaleString()
          }
          wx.showToast({ title: `${action}成功`, icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
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
      success: (res) => {
        if (res.confirm) {
          if (isOutbound) {
            // 确认出库：实际库存已在创建时扣减，标记归档
            const mockOrder = db.outboundOrders.find(o => o._id === order._id)
            if (mockOrder) {
              mockOrder.status = 'confirmed'
              mockOrder.confirmed_at = new Date().toLocaleString()
              mockOrder.updated_at = new Date().toLocaleString()
            }
          } else {
            // 预留单确认出库：从预留转为实际出库，扣减实际库存
            this._convertReserveToOutbound(order)
          }
          wx.showToast({ title: `${action}成功`, icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
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
