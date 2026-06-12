const db = require('../../utils/db')
const util = require('../../utils/util')

const TYPE_MAP = { single: '单独新增入库', batch: '批量新增入库', search: '搜索导入入库' }

Page({
  data: {
    log: {},
    logTypeLabel: '',
    inventoryName: '',
    totalQuantity: 0,
    orderNo: '',
    showEditModal: false,
    editItems: [],
    editRemark: '',
    editSearchKeyword: '',
    editSearchResults: [],
    showEditSearch: false,
    // 多选模式
    editMultiSelectMode: false,
    editCheckedIds: [],
    // 键盘高度（px），用于底部面板上移
    keyboardHeight: 0
  },

  onLoad(options) {
    this._logId = options.id
    this.loadLog()
  },

  onShow() {
    // 确保当前仓库的产品已加载
    var log = this.data.log
    if (log && log.inventory_id && db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(log.inventory_id, true).catch(function(e) {
        console.warn('[LogDetail] loadProducts 失败:', e)
      })
    }
  },

  onUnload() {
    // 清理键盘监听，防止页面卸载后残留
    if (this._keyboardListener) {
      wx.offKeyboardHeightChange(this._keyboardListener)
      this._keyboardListener = null
    }
  },

  onProductTap(e) {
    const productId = e.currentTarget.dataset.id
    if (productId) {
      var invId = this.data.log ? this.data.log.inventory_id : ''
      wx.navigateTo({ url: `/pages/inventory/detail?id=${productId}&inv_id=${invId}` })
    }
  },

  loadLog() {
    const log = db.inboundLogs.find(l => l._id === this._logId)
    if (!log) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    const totalQuantity = log.items.reduce((sum, item) => sum + item.quantity, 0)
    const inv = db.inventories.find(i => i._id === log.inventory_id)
    const orderNo = log.order_no || this._generateInboundNo(inv, log)
    this.setData({
      log,
      logTypeLabel: TYPE_MAP[log.type] || log.type,
      inventoryName: inv ? inv.name : '',
      totalQuantity,
      orderNo,
      editRemark: log.remark || ''
    })
    wx.setNavigationBarTitle({ title: '入库单详情' })
  },

  _generateInboundNo(inv, log) {
    if (!inv) return 'IN' + Date.now()
    const prefix = inv.name.substring(0, 2).toUpperCase()
    return util.generateOrderNo(prefix)
  },

  onEdit() {
    const log = this.data.log
    // 深拷贝 items 用于编辑
    const editItems = log.items.map(i => ({ ...i }))
    this.setData({
      showEditModal: true,
      editItems,
      editRemark: log.remark || '',
      editSearchKeyword: '',
      editSearchResults: [],
      showEditSearch: false
    })
    // 监听键盘高度变化，动态调整底部面板位置
    this._keyboardListener = (res) => {
      this.setData({ keyboardHeight: res.height })
    }
    wx.onKeyboardHeightChange(this._keyboardListener)
  },

  hideEditModal() {
    const log = this.data.log
    const hasChanges = this.data.editItems.length !== log.items.length ||
      this.data.editItems.some((item, i) => {
        const orig = log.items.find(o => o.product_id === item.product_id)
        return !orig || orig.quantity !== item.quantity
      }) ||
      (this.data.editRemark || '').trim() !== (log.remark || '').trim()

    const doHide = () => {
      // 移除键盘监听
      if (this._keyboardListener) {
        wx.offKeyboardHeightChange(this._keyboardListener)
        this._keyboardListener = null
      }
      this.setData({ showEditModal: false, keyboardHeight: 0 })
    }

    if (hasChanges) {
      wx.showModal({
        title: '提示',
        content: '编辑内容尚未保存，确定要放弃修改吗？',
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            doHide()
          }
        }
      })
    } else {
      doHide()
    }
  },

  onEditRemarkInput(e) {
    this.setData({ editRemark: e.detail.value })
  },

  onEditQtyInput(e) {
    const index = e.currentTarget.dataset.index
    const val = parseInt(e.detail.value) || 0
    const editItems = [...this.data.editItems]
    editItems[index].quantity = Math.max(0, val)
    this.setData({ editItems })
  },

  onEditIncreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const editItems = [...this.data.editItems]
    editItems[index].quantity++
    this.setData({ editItems })
  },

  onEditDecreaseQty(e) {
    const index = e.currentTarget.dataset.index
    const editItems = [...this.data.editItems]
    if (editItems[index].quantity > 0) {
      editItems[index].quantity--
    }
    this.setData({ editItems })
  },

  onEditRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    const editItems = [...this.data.editItems]
    editItems.splice(index, 1)
    this.setData({ editItems })
  },

  // 编辑弹窗内搜索添加商品
  onEditSearchInput(e) {
    this.setData({ editSearchKeyword: e.detail.value })
  },

  onEditSearch() {
    const keyword = this.data.editSearchKeyword.toLowerCase()
    if (!keyword) {
      this.setData({ editSearchResults: [], showEditSearch: false })
      return
    }
    const log = this.data.log
    const results = db.products.filter(p =>
      p.inventory_id === log.inventory_id &&
      (p.name.toLowerCase().includes(keyword) || p.code.toLowerCase().includes(keyword)) &&
      !this.data.editItems.find(i => i.product_id === p._id)
    )
    this.setData({ editSearchResults: results, showEditSearch: true })
  },

  onClearEditSearch() {
    this.setData({ editSearchResults: [], showEditSearch: false, editSearchKeyword: '' })
  },

  onEditAddProduct(e) {
    const product = e.currentTarget.dataset.product

    // 多选模式
    if (this.data.editMultiSelectMode) {
      const editCheckedIds = [...this.data.editCheckedIds]
      const idx = editCheckedIds.indexOf(product._id)
      if (idx > -1) {
        editCheckedIds.splice(idx, 1)
      } else {
        const exists = this.data.editItems.find(i => i.product_id === product._id)
        if (exists) {
          wx.showToast({ title: '该商品已添加', icon: 'none' })
          return
        }
        editCheckedIds.push(product._id)
      }
      this.setData({ editCheckedIds })
      return
    }

    // 单选模式
    const newItem = {
      product_id: product._id,
      product_name: product.name,
      product_code: product.code,
      quantity: 1,
      image_url: product.image_url || ''
    }
    this.setData({
      editItems: [...this.data.editItems, newItem],
      editSearchResults: [],
      showEditSearch: false,
      editSearchKeyword: ''
    })
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onToggleEditMultiSelect() {
    this.setData({
      editMultiSelectMode: !this.data.editMultiSelectMode,
      editCheckedIds: []
    })
  },

  onConfirmEditMultiSelect() {
    const newItems = []
    this.data.editCheckedIds.forEach(pid => {
      const product = this.data.editSearchResults.find(p => p._id === pid)
      if (!product) return
      const exists = this.data.editItems.find(i => i.product_id === pid)
      if (exists) return
      newItems.push({
        product_id: product._id,
        product_name: product.name,
        product_code: product.code,
        quantity: 1,
        image_url: product.image_url || ''
      })
    })
    this.setData({
      editItems: [...this.data.editItems, ...newItems],
      editSearchResults: [],
      showEditSearch: false,
      editSearchKeyword: '',
      editMultiSelectMode: false,
      editCheckedIds: []
    })
    if (newItems.length > 0) {
      wx.showToast({ title: `已添加 ${newItems.length} 种商品`, icon: 'success' })
    }
  },

  async onSaveEdit() {
    if (this.data.editItems.length === 0) {
      wx.showToast({ title: '至少保留一项商品', icon: 'none' })
      return
    }
    const hasZero = this.data.editItems.some(i => i.quantity <= 0)
    if (hasZero) {
      wx.showToast({ title: '商品数量不能为0', icon: 'none' })
      return
    }

    const log = db.inboundLogs.find(l => l._id === this._logId)
    if (!log) return

    wx.showLoading({ title: '保存中...', mask: true })

    try {
      // 构建新的 items 数组
      const newItems = this.data.editItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        product_code: i.product_code,
        quantity: i.quantity,
        image_url: i.image_url
      }))

      // 通过 API 更新入库记录（后端处理库存调整）
      await db.updateInboundLog(this._logId, {
        items: newItems,
        remark: this.data.editRemark.trim()
      })

      // 重新加载展示
      const updatedLog = db.inboundLogs.find(l => l._id === this._logId) || log
      const totalQuantity = updatedLog.items.reduce((sum, item) => sum + item.quantity, 0)
      // 移除键盘监听
      if (this._keyboardListener) {
        wx.offKeyboardHeightChange(this._keyboardListener)
        this._keyboardListener = null
      }
      this.setData({
        showEditModal: false,
        keyboardHeight: 0,
        log: { ...updatedLog },
        editRemark: updatedLog.remark || '',
        totalQuantity: totalQuantity
      })

      wx.hideLoading()
      wx.showToast({ title: '已保存', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      console.error('[入库记录] 保存失败:', err)
      wx.showToast({ title: '保存失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
    }
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除入库记录后，对应商品库存将回退。确定删除吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...', mask: true })
          try {
            await db.deleteInboundLog(this._logId)
            wx.hideLoading()
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } catch (err) {
            wx.hideLoading()
            console.error('[入库记录] 删除失败:', err)
            wx.showToast({ title: '删除失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
          }
        }
      }
    })
  }
})
