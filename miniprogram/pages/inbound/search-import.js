const mockData = require('../../utils/mock-data')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    searchResults: [],
    searched: false,
    selectedProduct: null,
    addQuantity: '',
    statusCodeLabels: mockData.statusCodes.map(s => `${s.code} - ${s.label}`),
    statusCodeIndex: 0
  },

  onLoad() {
    const inventories = mockData.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({ inventories, inventoryNames })
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
  },

  onSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], searched: false })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    const results = mockData.products.filter(p =>
      p.inventory_id === inventory._id &&
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
    const inventory = this.data.inventories[this.data.inventoryIndex]
    wx.showModal({
      title: '确认导入入库',
      content: `目录: ${inventory.name}\n商品: ${this.data.selectedProduct.name}\n新增数量: ${this.data.addQuantity}`,
      success: (res) => {
        if (res.confirm) {
          const newLog = {
            _id: 'inlog_' + Date.now(),
            inventory_id: inventory._id,
            type: 'search',
            items: [{
              product_id: this.data.selectedProduct._id,
              product_name: this.data.selectedProduct.name,
              product_code: this.data.selectedProduct.code,
              quantity: parseInt(this.data.addQuantity),
              image_url: this.data.selectedProduct.image_url || ''
            }],
            owner_openid: 'user_001',
            created_at: new Date().toLocaleString()
          }
          // 增加商品库存
          const product = mockData.products.find(p => p._id === this.data.selectedProduct._id)
          if (product) {
            product.quantity += parseInt(this.data.addQuantity)
            product.updated_at = new Date().toLocaleString()
          }
          mockData.inboundLogs.push(newLog)
          wx.showToast({ title: '导入成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
