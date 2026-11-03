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
    // P1 组合包
    combos: [],
    comboOptions: [],
    comboIndex: 0,
    selectedComboId: '',
    comboQuantity: 1,
    selectedCombo: null,
    totalQuantity: 0,
    submitting: false
  },

  onLoad(options) {
    this._presetInventoryId = (options && options.inventory_id) || ''
    this._presetComboId = (options && options.combo_id) || ''
    this.refreshInventories()
    this._saveOriginal()
  },

  _saveOriginal() {    var d = this.data
    this._originalData = {
      selectedItems: JSON.stringify(d.selectedItems),
      selectedComboId: d.selectedComboId,
      orderInfo: d.orderInfo,
      orderRemark: d.orderRemark
    }
  },

  _hasChanges() {
    if (!this._originalData) return false
    var d = this.data
    var o = this._originalData
    if (JSON.stringify(d.selectedItems) !== o.selectedItems) return true
    if (d.selectedComboId !== o.selectedComboId) return true
    if (d.orderInfo !== o.orderInfo) return true
    if (d.orderRemark !== o.orderRemark) return true
    return false
  },

  _sumQuantity(items) {
    var total = 0
    for (var i = 0; i < items.length; i++) {
      total += Number(items[i].quantity) || 0
    }
    return total
  },

  _applySelectedItems(items, extra) {
    var patch = { selectedItems: items, totalQuantity: this._sumQuantity(items) }
    if (extra) {
      for (var key in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, key)) patch[key] = extra[key]
      }
    }
    this.setData(patch)
  },

  _markDirty() {
    if (this._alertEnabled) return
    if (!this._hasChanges()) return
    this._alertEnabled = true
    this._disableAlert = wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
  },

  onShow() {
    // 页面显示时确保产品数据最新
    var inv = this.data.inventories[this.data.inventoryIndex]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(e) {
        console.warn('[Outbound] loadProducts 失败:', e)
      })
      this.loadCombos(true)
    }
  },

  async refreshInventories() {
    // 冷启动/深链进入时本地可能还没有目录缓存，先补拉一次
    if (!db.inventories.length && db.isBackendMode && db.isBackendMode()) {
      try {
        await db.loadInventories(true)
      } catch (e) {}
    }
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    var index = this.data.inventoryIndex
    if (this._presetInventoryId) {
      var presetIndex = inventories.findIndex(function(i) { return i._id === this._presetInventoryId }, this)
      if (presetIndex > -1) index = presetIndex
    }
    if (index >= inventories.length) index = 0
    var that = this
    this.setData({ inventories, inventoryNames, inventoryIndex: index }, function() {
      that.loadCombos()
    })
  },

  onInventoryChange(e) {
    var idx = e.detail.value
    this.setData({ inventoryIndex: idx, selectedComboId: '', selectedCombo: null, comboIndex: 0 })
    // 切换目录时，从后端加载该目录的商品
    var inv = this.data.inventories[idx]
    if (inv && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(inv._id, true).catch(function(err) {
        console.warn('[Outbound] loadProducts 失败:', err)
      })
    }
    this.loadCombos()
  },

  async loadCombos(force) {
    var inv = this.data.inventories[this.data.inventoryIndex]
    if (!inv || !db.isBackendMode || !db.isBackendMode()) {
      this.setData({ combos: [], comboOptions: [], selectedComboId: '', selectedCombo: null })
      return
    }
    try {
      var combos = (await db.loadCombos(inv._id, !!force)).filter(function(c) { return c.status === 'active' })
      var comboOptions = [{ label: '不使用组合包', value: '' }].concat(combos.map(function(c) {
        return { label: c.name + '（可售 ' + c.availability + '）', value: c._id }
      }))
      var selectedComboId = this.data.selectedComboId
      var presetComboId = this._presetComboId
      if (presetComboId && combos.some(function(c) { return c._id === presetComboId })) {
        selectedComboId = presetComboId
        this._presetComboId = ''
      }
      var comboIndex = comboOptions.findIndex(function(o) { return o.value === selectedComboId })
      if (comboIndex < 0) comboIndex = 0
      if (!selectedComboId && comboOptions.length) {
        selectedComboId = ''
      }
      this.setData({
        combos: combos,
        comboOptions: comboOptions,
        comboIndex: comboIndex,
        selectedComboId: selectedComboId,
        selectedCombo: combos.find(function(c) { return c._id === selectedComboId }) || null
      })
    } catch (err) {
      console.warn('[Outbound] 加载组合包失败:', (err && err.message) || err)
      this.setData({ combos: [], comboOptions: [], selectedCombo: null })
    }
  },

  onComboChange(e) {
    var idx = Number(e.detail.value)
    var option = this.data.comboOptions[idx]
    var combo = option ? this.data.combos.find(function(c) { return c._id === option.value }) : null
    this.setData({
      comboIndex: idx,
      selectedComboId: option ? option.value : '',
      selectedCombo: combo || null,
      comboQuantity: 1
    })
    this._markDirty()
  },

  onComboQuantityInput(e) {
    this.setData({ comboQuantity: parseInt(e.detail.value) || 1 })
    this._markDirty()
  },

  onClearCombo() {
    this.setData({ selectedComboId: '', selectedCombo: null, comboIndex: 0, comboQuantity: 1 })
    this._markDirty()
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
        const available = product.quantity || 0
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
    const available = product.quantity || 0
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
    this.setData({ totalQuantity: this._sumQuantity(this.data.selectedItems) })
    this._markDirty()
  },

  onToggleMultiSelect() {
    this.setData({ multiSelectMode: !this.data.multiSelectMode, checkedProductIds: [] })
    this._markDirty()
  },

  onConfirmMultiSelect() {
    const newItems = []
    this.data.checkedProductIds.forEach(pid => {
      const product = this.data.searchResults.find(p => p._id === pid)
      if (!product) return
      const exists = this.data.selectedItems.find(i => i.product_id === pid)
      if (exists) return
      const available = product.quantity || 0
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
    this.setData({ totalQuantity: this._sumQuantity(this.data.selectedItems) })
    if (newItems.length > 0) {
      this._markDirty()
      wx.showToast({ title: `已添加 ${newItems.length} 种商品`, icon: 'success' })
    }
  },

  onIncreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    if (items[index].quantity < items[index].stock) {
      items[index].quantity++
      this._applySelectedItems(items)
      this._markDirty()
    }
  },

  onDecreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    if (items[index].quantity > 1) {
      items[index].quantity--
      this._applySelectedItems(items)
      this._markDirty()
    }
  },

  onRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.selectedItems]
    items.splice(index, 1)
    this._applySelectedItems(items)
    this._markDirty()
  },

  onOrderInfoInput(e) {
    this.setData({ orderInfo: e.detail.value })
    this._markDirty()
  },

  onRemarkInput(e) {
    this.setData({ orderRemark: e.detail.value })
    this._markDirty()
  },

  async onSubmit() {
    if (this.data.submitting) return

    const inventory = this.data.inventories[this.data.inventoryIndex]
    if (!inventory) {
      wx.showToast({ title: '请先选择目录', icon: 'none' })
      return
    }

    const combo = this.data.selectedCombo
    var comboQuantity = Number(this.data.comboQuantity) || 0

    if (combo) {
      if (comboQuantity < 1) {
        wx.showToast({ title: '请填写组合包数量', icon: 'none' })
        return
      }
      if (comboQuantity > (combo.availability || 0)) {
        wx.showToast({ title: `「${combo.name}」可售数量不足`, icon: 'none' })
        return
      }
    } else {
      if (this.data.selectedItems.length === 0) {
        wx.showToast({ title: '请添加出库商品', icon: 'none' })
        return
      }
      // 检查可用库存是否充足（总量 - 已预留）
      const insufficient = this.data.selectedItems.find(i => {
        const product = db.products.find(p => p._id === i.product_id)
        if (!product) return true
        const available = product.quantity || 0
        return i.quantity > available
      })
      if (insufficient) {
        wx.showToast({ title: `「${insufficient.product_name}」可用库存不足`, icon: 'none' })
        return
      }
    }

    const modalContent = combo
      ? `目录: ${inventory.name}\n组合包: ${combo.name} × ${comboQuantity}`
      : `目录: ${inventory.name}\n共 ${this.data.selectedItems.length} 种商品`

    wx.showModal({
      title: '确认新建出库单',
      content: modalContent,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        this.setData({ submitting: true })
        wx.showLoading({ title: '创建中...', mask: true })

        try {
          var ts = new Date()
          var timeStr = ts.getFullYear() + String(ts.getMonth() + 1).padStart(2, '0') + String(ts.getDate()).padStart(2, '0') + String(ts.getHours()).padStart(2, '0') + String(ts.getMinutes()).padStart(2, '0') + String(ts.getSeconds()).padStart(2, '0')
          const orderNo = (this.data.orderInfo || (combo ? combo.name : inventory.name)) + '_' + timeStr

          var payload = {
            _id: 'out_' + Date.now(),
            inventory_id: inventory._id,
            order_no: orderNo,
            type: 'outbound',
            order_info: this.data.orderInfo,
            remark: this.data.orderRemark
          }

          if (combo) {
            payload.items = []
            payload.combo_id = combo._id
            payload.combo_quantity = comboQuantity
          } else {
            payload.items = this.data.selectedItems.map(i => ({
              product_id: i.product_id,
              product_name: i.product_name,
              product_code: i.product_code,
              quantity: i.quantity,
              image_url: i.image_url
            }))
          }

          // 通过 API 创建出库单（后端处理库存扣减）
          await db.createOutboundOrder(payload)

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
