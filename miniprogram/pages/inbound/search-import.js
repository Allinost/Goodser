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
    statusCodes: [],
    statusCodeLabels: [],
    statusCodeIndex: 0,
    // 多选模式
    multiSelectMode: false,
    checkedProductIds: [],
    // 多选商品列表（选中后的商品+数量）
    selectedProducts: [],
    submitting: false
  },

  onLoad() {
    this.refreshFormData()
  },

  onShow() {
    // 页面显示时确保产品数据最新
    var inv = this.data.inventories[this.data.inventoryIndex]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(e) {
        console.warn('[SearchImport] loadProducts 失败:', e)
      })
    }
  },

  refreshFormData() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const statusCodes = [...db.statusCodes]
    this.setData({
      inventories,
      inventoryNames,
      statusCodes: statusCodes,
      statusCodeLabels: statusCodes.map(s => `${s.code} - ${s.label}`)
    })
  },

  onInventoryChange(e) {
    var idx = e.detail.value
    this.setData({ inventoryIndex: idx })
    // 切换目录时，从后端加载该目录的商品
    var inv = this.data.inventories[idx]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(err) {
        console.warn('[SearchImport] loadProducts 失败:', err)
      })
    }
  },

  onSearch(e) {
    const keyword = e.detail.value.toLowerCase()
    if (!keyword) {
      this.setData({ searchResults: [], searched: false })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    if (!inventory) return
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
    this.enableUnloadAlert()
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

  enableUnloadAlert() {
    if (this._alertEnabled) return
    this._alertEnabled = true
    this._disableAlert = wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
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
    if (selectedProducts.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
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

  async onSubmit() {
    if (this.data.submitting) return
    // 多选提交
    if (this.data.selectedProducts.length > 0) {
      const invalid = this.data.selectedProducts.find(p => !p.quantity || parseInt(p.quantity) <= 0)
      if (invalid) {
        wx.showToast({ title: `请输入「${invalid.name}」的数量`, icon: 'none' })
        return
      }
      const inventory = this.data.inventories[this.data.inventoryIndex]
      if (!inventory) {
        wx.showToast({ title: '请选择目录', icon: 'none' })
        return
      }
      const totalQty = this.data.selectedProducts.reduce((s, p) => s + parseInt(p.quantity), 0)
      wx.showModal({
        title: '确认导入入库',
        content: `目录: ${inventory.name}\n共 ${this.data.selectedProducts.length} 种商品，合计 ${totalQty} 件`,
        success: async (modalRes) => {
          if (!modalRes.confirm) return

          this.setData({ submitting: true })
          wx.showLoading({ title: '导入中...', mask: true })

          try {
            const prefix = inventory.name.substring(0, 2).toUpperCase()
            const orderNo = util.generateOrderNo(prefix)
            await db.inboundSearchImport({
              inventory_id: inventory._id,
              order_no: orderNo,
              items: this.data.selectedProducts.map(function(sp) {
                return {
                  product_id: sp._id,
                  product_name: sp.name,
                  product_code: sp.code,
                  quantity: parseInt(sp.quantity),
                  image_url: sp.image_url || ''
                }
              })
            })
            if (this._disableAlert) {
              this._disableAlert()
              this._disableAlert = null
            }
            wx.hideLoading()
            wx.showToast({ title: '导入成功', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } catch (err) {
            wx.hideLoading()
            this.setData({ submitting: false })
            console.error('[搜索导入] 失败:', err)
            wx.showToast({ title: '导入失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
          }
        }
      })
      return
    }

    // 单选提交
    if (!this.data.selectedProduct) {
      wx.showToast({ title: '请选择商品', icon: 'none' })
      return
    }
    if (!this.data.addQuantity || parseInt(this.data.addQuantity) <= 0) {
      wx.showToast({ title: '请输入新增数量', icon: 'none' })
      return
    }
    const inventorySingle = this.data.inventories[this.data.inventoryIndex]
    if (!inventorySingle) {
      wx.showToast({ title: '请选择目录', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认导入入库',
      content: `目录: ${inventorySingle.name}\n商品: ${this.data.selectedProduct.name}\n新增数量: ${this.data.addQuantity}`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        this.setData({ submitting: true })
        wx.showLoading({ title: '导入中...', mask: true })

        try {
          const prefixSingle = inventorySingle.name.substring(0, 2).toUpperCase()
          const orderNoSingle = util.generateOrderNo(prefixSingle)
          await db.inboundSearchImport({
            inventory_id: inventorySingle._id,
            order_no: orderNoSingle,
            items: [{
              product_id: this.data.selectedProduct._id,
              product_name: this.data.selectedProduct.name,
              product_code: this.data.selectedProduct.code,
              quantity: parseInt(this.data.addQuantity),
              image_url: this.data.selectedProduct.image_url || ''
            }]
          })
          if (this._disableAlert) {
            this._disableAlert()
            this._disableAlert = null
          }
          wx.hideLoading()
          wx.showToast({ title: '导入成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1200)
        } catch (err) {
          wx.hideLoading()
          this.setData({ submitting: false })
          console.error('[搜索导入] 失败:', err)
          wx.showToast({ title: '导入失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
        }
      }
    })
  }
})
