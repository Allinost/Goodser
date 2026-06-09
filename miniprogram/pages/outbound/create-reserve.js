const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    orderInfo: '',
    orderRemark: '',
    searchResults: [],
    showSearchResults: false,
    selectedItems: []
  },

  onLoad() {
    const inventories = mockData.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({ inventories, inventoryNames })
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
  },

  onProductSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], showSearchResults: false })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    const results = mockData.products.filter(p =>
      p.inventory_id === inventory._id &&
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
      wx.showToast({ title: '请添加预留商品', icon: 'none' })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    wx.showModal({
      title: '确认新建预留单',
      content: `目录: ${inventory.name}\n共 ${this.data.selectedItems.length} 种商品，预留后库存将锁定`,
      success: (res) => {
        if (res.confirm) {
          const prefix = inventory.name.substring(0, 2).toUpperCase()
          const orderNo = util.generateOrderNo(prefix)
          const newOrder = {
            _id: 'rsv_' + Date.now(),
            inventory_id: inventory._id,
            order_no: orderNo,
            type: 'reserve',
            status: 'reserved',
            order_info: this.data.orderInfo,
            remark: this.data.orderRemark,
            items: this.data.selectedItems.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              product_code: i.product_code,
              quantity: i.quantity,
              image_url: i.image_url
            })),
            owner_openid: 'user_001',
            created_at: new Date().toLocaleString(),
            updated_at: new Date().toLocaleString(),
            confirmed_at: null,
            cancelled_at: null
          }
          mockData.outboundOrders.push(newOrder)
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
