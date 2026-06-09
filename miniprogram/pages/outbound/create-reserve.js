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
    selectedItems: [],
    // 多选模式
    multiSelectMode: false,
    checkedProductIds: []
  },

  onLoad() {
    wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
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
    if (this.data.multiSelectMode) {
      // 多选模式：切换勾选
      const checkedProductIds = [...this.data.checkedProductIds]
      const idx = checkedProductIds.indexOf(product._id)
      if (idx > -1) {
        checkedProductIds.splice(idx, 1)
      } else {
        const exists = this.data.selectedItems.find(i => i.product_id === product._id)
        if (exists) {
          wx.showToast({ title: '该商品已添加', icon: 'none' })
          return
        }
        checkedProductIds.push(product._id)
      }
      this.setData({ checkedProductIds })
      return
    }

    // 单选模式
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

  onToggleMultiSelect() {
    this.setData({ multiSelectMode: !this.data.multiSelectMode, checkedProductIds: [] })
  },

  onConfirmMultiSelect() {
    const newItems = []
    this.data.checkedProductIds.forEach(pid => {
      const product = this.data.searchResults.find(p => p._id === pid)
      if (!product) return
      const exists = this.data.selectedItems.find(i => i.product_id === pid)
      if (exists) return
      newItems.push({
        product_id: product._id,
        product_name: product.name,
        product_code: product.code,
        quantity: 1,
        stock: product.quantity,
        image_url: product.image_url
      })
    })
    this.setData({
      selectedItems: [...this.data.selectedItems, ...newItems],
      showSearchResults: false,
      multiSelectMode: false,
      checkedProductIds: []
    })
    if (newItems.length > 0) {
      wx.showToast({ title: `已添加 ${newItems.length} 种商品`, icon: 'success' })
    }
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
    // 检查可用库存是否充足（总量 - 已预留）
    const insufficient = this.data.selectedItems.find(i => {
      const product = mockData.products.find(p => p._id === i.product_id)
      if (!product) return true
      const available = product.quantity - (product.reserved_quantity || 0)
      return i.quantity > available
    })
    if (insufficient) {
      wx.showToast({ title: `「${insufficient.product_name}」可用库存不足`, icon: 'none' })
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
          // 锁定预留库存
          newOrder.items.forEach(item => {
            const product = mockData.products.find(p => p._id === item.product_id)
            if (product) {
              product.reserved_quantity = (product.reserved_quantity || 0) + item.quantity
              product.updated_at = new Date().toLocaleString()
            }
          })
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
