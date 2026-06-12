const db = require('../../utils/db')
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
    checkedProductIds: [],
    submitting: false
  },

  onLoad() {
    this.refreshInventories()
  },

  onShow() {
    // 页面显示时确保产品数据最新
    var inv = this.data.inventories[this.data.inventoryIndex]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(e) {
        console.warn('[Outbound] loadProducts 失败:', e)
      })
    }
  },

  refreshInventories() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({ inventories, inventoryNames })
  },

  onInventoryChange(e) {
    var idx = e.detail.value
    this.setData({ inventoryIndex: idx })
    // 切换目录时，从后端加载该目录的商品
    var inv = this.data.inventories[idx]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(err) {
        console.warn('[Outbound] loadProducts 失败:', err)
      })
    }
  },

  onProductSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], showSearchResults: false })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    if (!inventory) {
      wx.showToast({ title: '请先选择目录', icon: 'none' })
      return
    }
    const results = db.products.filter(p =>
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
        // 检查是否已在已选列表或库存不足
        const exists = this.data.selectedItems.find(i => i.product_id === product._id)
        if (exists) {
          wx.showToast({ title: '该商品已添加', icon: 'none' })
          return
        }
        const available = product.quantity - (product.reserved_quantity || 0)
        if (available <= 0) {
          wx.showToast({ title: '该商品可用库存不足', icon: 'none' })
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
    const available = product.quantity - (product.reserved_quantity || 0)
    if (available <= 0) {
      wx.showToast({ title: '该商品可用库存不足', icon: 'none' })
      return
    }
    const newItem = {
      product_id: product._id,
      product_name: product.name,
      product_code: product.code,
      quantity: 1,
      stock: available,
      image_url: product.image_url
    }
    this.setData({
      selectedItems: [...this.data.selectedItems, newItem],
      showSearchResults: false
    })
    this.enableUnloadAlert()
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
      const available = product.quantity - (product.reserved_quantity || 0)
      if (available <= 0) return
      newItems.push({
        product_id: product._id,
        product_name: product.name,
        product_code: product.code,
        quantity: 1,
        stock: available,
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
      this.enableUnloadAlert()
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

  enableUnloadAlert() {
    if (this._alertEnabled) return
    this._alertEnabled = true
    this._disableAlert = wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (this.data.selectedItems.length === 0) {
      wx.showToast({ title: '请添加出库商品', icon: 'none' })
      return
    }
    // 检查可用库存是否充足（总量 - 已预留）
    const insufficient = this.data.selectedItems.find(i => {
      const product = db.products.find(p => p._id === i.product_id)
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
      title: '确认新建出库单',
      content: `目录: ${inventory.name}\n共 ${this.data.selectedItems.length} 种商品`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        this.setData({ submitting: true })
        wx.showLoading({ title: '创建中...', mask: true })

        try {
          const prefix = inventory.name.substring(0, 2).toUpperCase()
          const orderNo = util.generateOrderNo(prefix)
          // 通过 API 创建出库单（后端处理库存扣减）
          await db.createOutboundOrder({
            _id: 'out_' + Date.now(),
            inventory_id: inventory._id,
            order_no: orderNo,
            type: 'outbound',
            status: 'pending',
            order_info: this.data.orderInfo,
            remark: this.data.orderRemark,
            items: this.data.selectedItems.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              product_code: i.product_code,
              quantity: i.quantity,
              image_url: i.image_url
            }))
          })

          if (this._disableAlert) {
            this._disableAlert()
            this._disableAlert = null
          }

          wx.hideLoading()
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1200)
        } catch (err) {
          wx.hideLoading()
          this.setData({ submitting: false })
          console.error('[出库] 创建失败:', err)
          wx.showToast({ title: '创建失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
        }
      }
    })
  }
})
