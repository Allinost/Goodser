const db = require('../../utils/db')
const util = require('../../utils/util')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    searchResults: [],
    searched: false,
    selectedProduct: null,
    addQuantity: '',
    statusCodeLabels: db.statusCodes.map(s => `${s.code} - ${s.label}`),
    statusCodeIndex: 0,
    // 多选模式
    multiSelectMode: false,
    checkedProductIds: [],
    // 多选商品列表（选中后的商品+数量）
    selectedProducts: []
  },

  onLoad() {
    wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
    const inventories = db.inventories
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
    const results = db.products.filter(p =>
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
    if (this.data.multiSelectMode) {
      // 多选：切换勾选
      const checkedProductIds = [...this.data.checkedProductIds]
      const idx = checkedProductIds.indexOf(product._id)
      if (idx > -1) {
        checkedProductIds.splice(idx, 1)
      } else {
        checkedProductIds.push(product._id)
      }
      this.setData({ checkedProductIds })
      return
    }

    // 单选模式
    this.setData({ selectedProduct: product, addQuantity: '' })
  },

  onToggleMultiSelect() {
    const next = !this.data.multiSelectMode
    this.setData({
      multiSelectMode: next,
      checkedProductIds: [],
      selectedProducts: next ? [] : this.data.selectedProducts,
      selectedProduct: next ? null : this.data.selectedProduct
    })
  },

  onConfirmMultiSelect() {
    // 将勾选商品加入已选列表
    const selectedProducts = []
    this.data.checkedProductIds.forEach(pid => {
      const product = this.data.searchResults.find(p => p._id === pid)
      if (product) {
        selectedProducts.push({
          _id: product._id,
          name: product.name,
          code: product.code,
          image_url: product.image_url,
          quantity: '',
          currentStock: product.quantity
        })
      }
    })
    this.setData({
      selectedProducts,
      multiSelectMode: false,
      checkedProductIds: [],
      selectedProduct: null
    })
  },

  onMultiQtyInput(e) {
    const index = e.currentTarget.dataset.index
    const val = e.detail.value
    const selectedProducts = [...this.data.selectedProducts]
    selectedProducts[index].quantity = val
    this.setData({ selectedProducts })
  },

  onRemoveSelectedProduct(e) {
    const index = e.currentTarget.dataset.index
    const selectedProducts = [...this.data.selectedProducts]
    selectedProducts.splice(index, 1)
    this.setData({ selectedProducts })
  },

  onQuantityInput(e) {
    this.setData({ addQuantity: e.detail.value })
  },

  onStatusCodeChange(e) {
    this.setData({ statusCodeIndex: e.detail.value })
  },

  onSubmit() {
    // 多选提交
    if (this.data.selectedProducts.length > 0) {
      const invalid = this.data.selectedProducts.find(p => !p.quantity || parseInt(p.quantity) <= 0)
      if (invalid) {
        wx.showToast({ title: `请输入「${invalid.name}」的数量`, icon: 'none' })
        return
      }
      const inventory = this.data.inventories[this.data.inventoryIndex]
      const totalQty = this.data.selectedProducts.reduce((s, p) => s + parseInt(p.quantity), 0)
      wx.showModal({
        title: '确认导入入库',
        content: `目录: ${inventory.name}\n共 ${this.data.selectedProducts.length} 种商品，合计 ${totalQty} 件`,
        success: (res) => {
          if (res.confirm) {
            const logItems = []
            this.data.selectedProducts.forEach(sp => {
              const product = db.products.find(p => p._id === sp._id)
              if (product) {
                product.quantity += parseInt(sp.quantity)
                product.updated_at = new Date().toLocaleString()
              }
              logItems.push({
                product_id: sp._id,
                product_name: sp.name,
                product_code: sp.code,
                quantity: parseInt(sp.quantity),
                image_url: sp.image_url || ''
              })
            })
            const prefix = inventory.name.substring(0, 2).toUpperCase()
            const orderNo = util.generateOrderNo(prefix)
            const newLog = {
              _id: 'inlog_' + Date.now(),
              inventory_id: inventory._id,
              order_no: orderNo,
              type: 'search',
              items: logItems,
              owner_openid: 'user_001',
              created_at: new Date().toLocaleString()
            }
            db.inboundLogs.push(newLog)
            wx.showToast({ title: '导入成功', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1500)
          }
        }
      })
      return
    }

    // 单选提交
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
          const product = db.products.find(p => p._id === this.data.selectedProduct._id)
          if (product) {
            product.quantity += parseInt(this.data.addQuantity)
            product.updated_at = new Date().toLocaleString()
          }
          db.inboundLogs.push(newLog)
          wx.showToast({ title: '导入成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
