const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    order: {},
    statusLabel: '',
    statusTagClass: '',
    totalQuantity: 0
  },

  onLoad(options) {
    const order = mockData.outboundOrders.find(o => o._id === options.id)
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

  onCancel() {
    const action = this.data.order.type === 'outbound' ? '取消出库' : '取消预留'
    wx.showModal({
      title: `确认${action}`,
      content: `${action}后库存将恢复，确定继续吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: `${action}成功`, icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  },

  onConfirm() {
    const isOutbound = this.data.order.type === 'outbound'
    const action = isOutbound ? '确认出库' : '准备出库'
    wx.showModal({
      title: `确认${action}`,
      content: isOutbound ? '确认出库后将归档此出库单' : '准备出库后将生成对应的出库单',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: `${action}成功`, icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
