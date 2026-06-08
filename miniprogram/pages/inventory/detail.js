const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    product: {},
    statusLabel: '',
    statusTagClass: ''
  },

  onLoad(options) {
    const product = mockData.products.find(p => p._id === options.id)
    if (product) {
      this.setData({
        product,
        statusLabel: util.getStatusLabel(product.status_code),
        statusTagClass: util.getStatusTagClass(product.status_code)
      })
    }
  },

  onEdit() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${this.data.product.name}」吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '删除成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
