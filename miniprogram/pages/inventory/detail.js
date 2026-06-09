const mockData = require('../../utils/mock-data')
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
    tagSearchKeyword: '',
    availableTags: [],
    showNewTagDialog: false,
    newTagName: '',
    newTagColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS
  },

  onLoad(options) {
    this._productId = options.id
    this.loadProduct()
  },

  onShow() {
    if (this._productId) this.loadProduct()
  },

  loadProduct() {
    const product = mockData.products.find(p => p._id === this._productId)
    if (product) {
      this.setData({
        product,
        statusLabel: util.getStatusLabel(product.status_code),
        statusTagClass: util.getStatusTagClass(product.status_code)
      })
      this.loadProductTags()
    }
  },

  loadProductTags() {
    const product = this.data.product
    const productTags = (product.tags || []).map(tid => {
      return mockData.tags.find(t => t._id === tid)
    }).filter(Boolean)
    this.setData({ productTags })
  },

  // 标签选择
  onAddTag() {
    this.setData({
      showTagPicker: true,
      tagSearchKeyword: '',
      availableTags: [...mockData.tags]
    })
  },

  hideTagPicker() {
    this.setData({ showTagPicker: false })
  },

  onTagSearchInput(e) {
    const keyword = e.detail.value.trim()
    this.setData({ tagSearchKeyword: keyword })
    const filtered = keyword
      ? mockData.tags.filter(t => t.name.includes(keyword))
      : [...mockData.tags]
    this.setData({ availableTags: filtered })
  },

  onToggleTag(e) {
    const tagId = e.currentTarget.dataset.id
    const product = this.data.product
    if (!product.tags) product.tags = []

    const idx = product.tags.indexOf(tagId)
    if (idx > -1) {
      product.tags.splice(idx, 1)
    } else {
      product.tags.push(tagId)
    }
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

  onConfirmNewTag() {
    const name = this.data.newTagName.trim()
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' })
      return
    }
    if (mockData.tags.some(t => t.name === name)) {
      wx.showToast({ title: '标签已存在', icon: 'none' })
      return
    }
    const newTag = {
      _id: 'tag_' + Date.now(),
      name,
      color: this.data.newTagColor,
      owner_openid: 'user_001',
      created_at: new Date().toLocaleString()
    }
    mockData.tags.push(newTag)
    // 自动选中新标签
    this.addTagToProduct(newTag._id)
    this.setData({
      showNewTagDialog: false,
      availableTags: [...mockData.tags]
    })
    this.loadProductTags()
    wx.showToast({ title: '标签已创建', icon: 'success' })
  },

  onRemoveTag(e) {
    const tagId = e.currentTarget.dataset.id
    const product = this.data.product
    if (product.tags) {
      const idx = product.tags.indexOf(tagId)
      if (idx > -1) {
        product.tags.splice(idx, 1)
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
    wx.navigateTo({ url: `/pages/inventory/edit?id=${this.data.product._id}` })
  },

  onDelete() {
    const product = this.data.product
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${product.name}」吗？删除后编码序号可被回收复用。`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 检查是否有未完成的出库单关联该商品
          const pendingOrders = mockData.outboundOrders.filter(o =>
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
          // 从商品列表中移除
          const idx = mockData.products.findIndex(p => p._id === product._id)
          if (idx > -1) {
            mockData.products.splice(idx, 1)
          }
          wx.showToast({ title: '删除成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
