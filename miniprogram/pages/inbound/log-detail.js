const mockData = require('../../utils/mock-data')
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
    showEditSearch: false
  },

  onLoad(options) {
    this._logId = options.id
    this.loadLog()
  },

  loadLog() {
    const log = mockData.inboundLogs.find(l => l._id === this._logId)
    if (!log) {
      wx.showToast({ title: '记录不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    const totalQuantity = log.items.reduce((sum, item) => sum + item.quantity, 0)
    const inv = mockData.inventories.find(i => i._id === log.inventory_id)
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
  },

  hideEditModal() {
    this.setData({ showEditModal: false })
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
    const results = mockData.products.filter(p =>
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

  onSaveEdit() {
    if (this.data.editItems.length === 0) {
      wx.showToast({ title: '至少保留一项商品', icon: 'none' })
      return
    }
    const hasZero = this.data.editItems.some(i => i.quantity <= 0)
    if (hasZero) {
      wx.showToast({ title: '商品数量不能为0', icon: 'none' })
      return
    }

    const log = mockData.inboundLogs.find(l => l._id === this._logId)
    if (!log) return

    // 计算库存差异并调整
    this.data.editItems.forEach(editItem => {
      const originalItem = log.items.find(i => i.product_id === editItem.product_id)
      const diff = editItem.quantity - (originalItem ? originalItem.quantity : 0)

      // 更新商品库存
      if (editItem.product_id && diff !== 0) {
        const product = mockData.products.find(p => p._id === editItem.product_id)
        if (product) {
          product.quantity = Math.max(0, product.quantity + diff)
          product.updated_at = new Date().toLocaleString()
        }
      }
    })

    // 处理被移除的商品项（回退库存）
    log.items.forEach(originalItem => {
      const stillExists = this.data.editItems.find(i => i.product_id === originalItem.product_id)
      if (!stillExists && originalItem.product_id) {
        const product = mockData.products.find(p => p._id === originalItem.product_id)
        if (product) {
          product.quantity = Math.max(0, product.quantity - originalItem.quantity)
          product.updated_at = new Date().toLocaleString()
        }
      }
    })

    // 更新入库记录
    log.items = this.data.editItems.map(i => ({
      product_id: i.product_id,
      product_name: i.product_name,
      product_code: i.product_code,
      quantity: i.quantity,
      image_url: i.image_url
    }))
    log.remark = this.data.editRemark.trim()
    log.updated_at = new Date().toLocaleString()

    this.setData({
      showEditModal: false,
      log: { ...log },
      editRemark: log.remark
    })
    // 重新计算总量
    const totalQuantity = log.items.reduce((sum, item) => sum + item.quantity, 0)
    this.setData({ totalQuantity })

    wx.showToast({ title: '已保存', icon: 'success' })
  },

  onDelete() {
    wx.showModal({
      title: '确认删除',
      content: '删除入库记录后，对应商品库存将回退。确定删除吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this._revertInventory()
          const idx = mockData.inboundLogs.findIndex(l => l._id === this._logId)
          if (idx > -1) {
            mockData.inboundLogs.splice(idx, 1)
          }
          wx.showToast({ title: '已删除', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  },

  _revertInventory() {
    const log = this.data.log
    if (!log || !log.items) return
    log.items.forEach(item => {
      if (item.product_id) {
        const product = mockData.products.find(p => p._id === item.product_id)
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity)
          product.updated_at = new Date().toLocaleString()
        }
      }
    })
  }
})
