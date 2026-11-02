const db = require('../../utils/db')

Page({
  data: {
    inventoryId: '',
    comboId: '',
    name: '',
    code: '',
    price: '',
    status: 'active',
    items: [],
    statusOptions: [
      { label: '启用', value: 'active' },
      { label: '停用', value: 'inactive' }
    ],
    statusIndex: 0,
    keyword: '',
    searchResults: [],
    searching: false,
    submitting: false
  },

  onLoad(options) {
    this.setData({
      inventoryId: options.inventory_id || '',
      comboId: options.id || ''
    })
    if (options.id) {
      this.loadCombo(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新建组合包' })
    }
  },

  async loadCombo(id) {
    wx.showLoading({ title: '加载中...' })
    try {
      var combo = await db.getCombo(id)
      var statusIndex = combo.status === 'inactive' ? 1 : 0
      this.setData({
        name: combo.name || '',
        code: combo.code || '',
        price: combo.price ? String(combo.price) : '',
        status: combo.status || 'active',
        statusIndex: statusIndex,
        items: (combo.items || []).map(function(item) {
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code,
            quantity: item.quantity,
            stock: item.available
          }
        })
      })
      wx.setNavigationBarTitle({ title: '编辑组合包' })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onPriceInput(e) { this.setData({ price: e.detail.value }) },

  onStatusChange(e) {
    var idx = Number(e.detail.value)
    this.setData({
      statusIndex: idx,
      status: this.data.statusOptions[idx].value
    })
  },

  onKeywordInput(e) {
    var keyword = e.detail.value
    this.setData({ keyword: keyword })
    if (this._searchTimer) clearTimeout(this._searchTimer)
    var that = this
    this._searchTimer = setTimeout(function() {
      that.searchProducts()
    }, 300)
  },

  async searchProducts() {
    var keyword = this.data.keyword.trim()
    if (!keyword || !this.data.inventoryId) {
      this.setData({ searchResults: [] })
      return
    }
    this.setData({ searching: true })
    try {
      var res = await db.queryProducts({
        inventory_id: this.data.inventoryId,
        keyword: keyword,
        page: 1,
        page_size: 20
      })
      this.setData({ searchResults: (res && res.items) || [] })
    } catch (err) {
      this.setData({ searchResults: [] })
    } finally {
      this.setData({ searching: false })
    }
  },

  onAddProduct(e) {
    var product = e.currentTarget.dataset.product
    if (!product) return
    if (this.data.items.some(function(i) { return i.product_id === product._id })) {
      wx.showToast({ title: '已添加该商品', icon: 'none' })
      return
    }
    var items = this.data.items.concat([{
      product_id: product._id,
      product_name: product.name,
      product_code: product.code,
      quantity: 1,
      stock: product.quantity || 0
    }])
    this.setData({ items: items, keyword: '', searchResults: [] })
  },

  onRemoveItem(e) {
    var items = this.data.items.slice()
    items.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ items: items })
  },

  onQtyInput(e) {
    var index = Number(e.currentTarget.dataset.index)
    var value = parseInt(e.detail.value) || 0
    var items = this.data.items.slice()
    items[index].quantity = value
    this.setData({ items: items })
  },

  async onSave() {
    if (this.data.submitting) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入组合包名称', icon: 'none' })
      return
    }
    if (!this.data.items.length) {
      wx.showToast({ title: '请至少添加一个组件商品', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      var payload = {
        name: this.data.name.trim(),
        code: this.data.code.trim() || null,
        price: parseFloat(this.data.price) || 0,
        status: this.data.status,
        items: this.data.items.map(function(item) {
          return { product_id: item.product_id, quantity: Number(item.quantity) || 1 }
        })
      }
      if (this.data.comboId) {
        await db.updateCombo(this.data.comboId, this.data.inventoryId, payload)
      } else {
        await db.createCombo(this.data.inventoryId, payload)
      }
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(function() { wx.navigateBack() }, 1000)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }
})
