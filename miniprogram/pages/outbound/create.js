const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    orderInfo: '',
    orderRemark: '',
    searchResults: [],
    showSearchResults: false,
    selectedItems: []
  },

  onProductSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], showSearchResults: false })
      return
    }
    const results = mockData.products.filter(p =>
      p.inventory_id === 'inv_001' &&
      (p.name.toLowerCase().includes(keyword) || p.code.toLowerCase().includes(keyword))
    )
    this.setData({ searchResults: results, showSearchResults: true })
  },

  onClearProductSearch() {
    this.setData({ searchResults: [], showSearchResults: false })
  },

  onAddProduct(e) {
    const product = e.currentTarget.dataset.product
    const exists = this.data.selectedItems.find(i => i.product_id === product._id)
    if (exists) {
      wx.showToast({ title: '已添加该商品', icon: 'none' })
      return
    }
    const newItem = {
      product_id: product._id,
      product_name: product.name,
      product_code: product.code,
      quantity: 1,
      stock: product.quantity,
      image_url: product.image_url
    }
    this.setData({
      selectedItems: [...this.data.selectedItems, newItem],
      showSearchResults: false
    })
  },

  onIncreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    if (items[index].quantity < items[index].stock) {
      items[index].quantity++
      this.setData({ selectedItems: items })
    }
  },

  onDecreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    if (items[index].quantity > 1) {
      items[index].quantity--
      this.setData({ selectedItems: items })
    }
  },

  onRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    items.splice(index, 1)
    this.setData({ selectedItems: items })
  },

  onOrderInfoInput(e) {
    this.setData({ orderInfo: e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ orderRemark: e.detail.value })
  },

  onSubmit() {
    if (this.data.selectedItems.length === 0) {
      wx.showToast({ title: '请添加出库商品', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认新建出库单',
      content: `共 ${this.data.selectedItems.length} 种商品`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
