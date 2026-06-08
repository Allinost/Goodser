const mockData = require('../../utils/mock-data')

Page({
  data: {
    searchResults: [],
    searched: false,
    selectedProduct: null,
    addQuantity: '',
    statusCodeLabels: mockData.statusCodes.map(s => `${s.code} - ${s.label}`),
    statusCodeIndex: 0
  },

  onSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], searched: false })
      return
    }
    const results = mockData.products.filter(p =>
      p.inventory_id === 'inv_001' &&
      (p.name.toLowerCase().includes(keyword) || p.code.toLowerCase().includes(keyword))
    )
    this.setData({ searchResults: results, searched: true })
  },

  onClearSearch() {
    this.setData({ searchResults: [], searched: false, selectedProduct: null })
  },

  onSelectProduct(e) {
    const product = e.currentTarget.dataset.product
    this.setData({ selectedProduct: product, addQuantity: '' })
  },

  onQuantityInput(e) {
    this.setData({ addQuantity: e.detail.value })
  },

  onStatusCodeChange(e) {
    this.setData({ statusCodeIndex: e.detail.value })
  },

  onSubmit() {
    if (!this.data.addQuantity || parseInt(this.data.addQuantity) <= 0) {
      wx.showToast({ title: '请输入新增数量', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认导入入库',
      content: `商品: ${this.data.selectedProduct.name}\n新增数量: ${this.data.addQuantity}`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '导入成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
