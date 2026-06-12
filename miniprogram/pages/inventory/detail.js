const db = require('../../utils/db')
const util = require('../../utils/util')

const COLOR_OPTIONS = [
  '#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#13c2c2',
  '#1890ff', '#2f54eb', '#722ed1', '#eb2f96', '#666666'
]

Page({
  data: {
    product: {},
    statusLabel: '',
    statusTagClass: '',
    productTags: [],
    showTagPicker: false,
    availableTags: [],
    showNewTagDialog: false,
    newTagName: '',
    newTagColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS
  },

  onLoad(options) {
    this._productId = options.id
    this._inventoryId = options.inv_id || ''
    this.loadProduct()
  },

  onShow() {
    if (this._productId) this.loadProduct()
  },

  loadProduct() {
    var that = this
    var product = db.products.find(function(p) { return p._id === that._productId })
    if (product) {
      this._renderProduct(product)
      return
    }
    // 商品不在本地缓存，尝试从后端加载
    if (!db.isBackendMode || !db.isBackendMode()) {
      this.setData({ product: {} })
      return
    }
    // 如果有 inventory_id，直接加载该仓库的产品
    if (this._inventoryId) {
      wx.showLoading({ title: '加载中…' })
      db.loadProducts(this._inventoryId, true).then(function() {
        wx.hideLoading()
        var p = db.products.find(function(p2) { return p2._id === that._productId })
        if (p) {
          that._renderProduct(p)
        } else {
          that._loadAllInventories()
        }
      }).catch(function() {
        wx.hideLoading()
        that._loadAllInventories()
      })
      return
    }
    // 没有 inventory_id：遍历所有库存目录查找
    this._loadAllInventories()
  },

  _loadAllInventories() {
    var that = this
    var invs = db.inventories
    if (invs.length === 0) {
      this.setData({ product: {} })
      wx.showToast({ title: '没有可用的库存目录', icon: 'none' })
      return
    }
    wx.showLoading({ title: '搜索中…' })
    var promises = invs.map(function(inv) {
      return db.loadProducts(inv._id, true).catch(function() { return null })
    })
    Promise.all(promises).then(function() {
      wx.hideLoading()
      var p = db.products.find(function(p2) { return p2._id === that._productId })
      if (p) {
        that._renderProduct(p)
      } else {
        that.setData({ product: {} })
        wx.showToast({ title: '商品未找到', icon: 'none' })
      }
    }).catch(function() {
      wx.hideLoading()
      that.setData({ product: {} })
    })
  },

  _renderProduct(product) {
    this.setData({
      product: product,
      statusLabel: util.getStatusLabel(product.status_code),
      statusTagClass: util.getStatusTagClass(product.status_code)
    })
    this.loadProductTags()
  },

  loadProductTags() {
    const product = this.data.product
    const productTags = (product.tags || []).map(tid => {
      return db.tags.find(t => t._id === tid)
    }).filter(Boolean)
    this.setData({ productTags })
  },

  // 标签选择
  onAddTag() {
    this.setData({
      showTagPicker: true,
      availableTags: [...db.tags]
    })
  },

  hideTagPicker() {
    this.setData({ showTagPicker: false })
  },

  async onToggleTag(e) {
    const tagId = e.currentTarget.dataset.id
    const product = this.data.product
    if (!product.tags) product.tags = []

    const idx = product.tags.indexOf(tagId)
    if (idx > -1) {
      product.tags.splice(idx, 1)
    } else {
      product.tags.push(tagId)
    }
    // 持久化标签变更
    await db.updateProduct(product._id, { tags: [...product.tags] })
    this.setData({ product })
    this.loadProductTags()
  },

  isTagSelected(tagId) {
    return (this.data.product.tags || []).includes(tagId)
  },

  // 新建标签弹窗
  onShowNewTagDialog() {
    this.setData({ showNewTagDialog: true, newTagName: '', newTagColor: COLOR_OPTIONS[0] })
  },

  hideNewTagDialog() {
    this.setData({ showNewTagDialog: false })
  },

  onNewTagNameInput(e) {
    this.setData({ newTagName: e.detail.value })
  },

  onSelectColor(e) {
    this.setData({ newTagColor: e.currentTarget.dataset.color })
  },

  async onConfirmNewTag() {
    const name = this.data.newTagName.trim()
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' })
      return
    }
    if (db.tags.some(t => t.name === name)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    const result = await db.createTag({
      name: name,
      color: this.data.newTagColor
    })
    const newTagId = result ? result._id : ('tag_' + Date.now())
    // 自动选中新标签并持久化
    const product = this.data.product
    if (!product.tags) product.tags = []
    product.tags.push(newTagId)
    await db.updateProduct(product._id, { tags: [...product.tags] })
    this.setData({
      showNewTagDialog: false,
      availableTags: [...db.tags],
      product: product
    })
    this.loadProductTags()
    wx.showToast({ title: '标签已创建', icon: 'success' })
  },

  async onRemoveTag(e) {
    const tagId = e.currentTarget.dataset.id
    const product = this.data.product
    if (product.tags) {
      const idx = product.tags.indexOf(tagId)
      if (idx > -1) {
        product.tags.splice(idx, 1)
        await db.updateProduct(product._id, { tags: [...product.tags] })
        this.setData({ product })
        this.loadProductTags()
        wx.showToast({ title: '已移除标签', icon: 'success' })
      }
    }
  },

  addTagToProduct(tagId) {
    const product = this.data.product
    if (!product.tags) product.tags = []
    if (!product.tags.includes(tagId)) {
      product.tags.push(tagId)
    }
    this.setData({ product })
  },

  onEdit() {
    var prod = this.data.product
    wx.navigateTo({ url: `/pages/inventory/edit?id=${prod._id}&inv_id=${prod.inventory_id || ''}` })
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  onDelete() {
    const product = this.data.product
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${product.name}」吗？删除后编码序号可被回收复用。`,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          // 检查是否有未完成的出库单关联该商品
          const pendingOrders = db.outboundOrders.filter(o =>
            o.status !== 'cancelled' && o.status !== 'confirmed' &&
            o.items.some(i => i.product_id === product._id)
          )
          if (pendingOrders.length > 0) {
            wx.showModal({
              title: '无法删除',
              content: `该商品有 ${pendingOrders.length} 个未完成的出库/预留单，请先处理相关订单`,
              showCancel: false
            })
            return
          }
          wx.showLoading({ title: '删除中...', mask: true })
          try {
            // 通过 API 持久化删除
            await db.deleteProduct(product._id)
            wx.hideLoading()
            wx.showToast({ title: '删除成功', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 1200)
          } catch (err) {
            wx.hideLoading()
            console.error('[删除商品] 失败:', err)
            wx.showToast({ title: '删除失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
          }
        }
      }
    })
  }
})
