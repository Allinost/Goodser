const util = require('../../utils/util')
const mockData = require('../../utils/mock-data')

const COLOR_OPTIONS = [
  '#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#13c2c2',
  '#1890ff', '#2f54eb', '#722ed1', '#eb2f96', '#666666'
]

Page({
  data: {
    productId: '',
    imageUrl: '',
    name: '',
    originalPrice: '',
    marketPrice: '',
    expectedPrice: '',
    quantity: '',
    storageLocation: '',
    remark: '',
    mainZones: util.ZONES,
    subZones: util.ZONES,
    mainZoneIndex: 0,
    subZoneIndex: 0,
    statusCodes: mockData.statusCodes,
    statusCodeLabels: mockData.statusCodes.map(s => `${s.code} - ${s.label}`),
    statusCodeIndex: 0,
    previewCode: '',
    allTags: [],
    selectedTagIds: [],
    showNewTagDialog: false,
    newTagName: '',
    newTagColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS
  },

  onLoad(options) {
    const product = mockData.products.find(p => p._id === options.id)
    if (!product) {
      wx.showToast({ title: '商品不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }

    const mainZoneIndex = util.ZONES.indexOf(product.main_zone)
    const subZoneIndex = util.ZONES.indexOf(product.sub_zone)
    const statusCodeIndex = mockData.statusCodes.findIndex(s => s.code === product.status_code)

    this.setData({
      productId: product._id,
      imageUrl: product.image_url || '',
      name: product.name,
      originalPrice: String(product.original_price || ''),
      marketPrice: String(product.market_price || ''),
      expectedPrice: String(product.expected_price || ''),
      quantity: String(product.quantity),
      storageLocation: product.storage_location || '',
      remark: product.remark || '',
      mainZoneIndex: mainZoneIndex > -1 ? mainZoneIndex : 0,
      subZoneIndex: subZoneIndex > -1 ? subZoneIndex : 0,
      statusCodeIndex: statusCodeIndex > -1 ? statusCodeIndex : 0,
      allTags: [...mockData.tags],
      selectedTagIds: [...(product.tags || [])]
    })

    this.updatePreview()
    wx.setNavigationBarTitle({ title: '编辑商品' })
  },

  onChooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ imageUrl: res.tempFilePaths[0] })
      }
    })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onOriginalPriceInput(e) { this.setData({ originalPrice: e.detail.value }) },
  onMarketPriceInput(e) { this.setData({ marketPrice: e.detail.value }) },
  onExpectedPriceInput(e) { this.setData({ expectedPrice: e.detail.value }) },
  onQuantityInput(e) { this.setData({ quantity: e.detail.value }); this.updatePreview() },
  onStorageLocationInput(e) { this.setData({ storageLocation: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  onMainZoneChange(e) { this.setData({ mainZoneIndex: e.detail.value }); this.updatePreview() },
  onSubZoneChange(e) { this.setData({ subZoneIndex: e.detail.value }); this.updatePreview() },
  onStatusCodeChange(e) { this.setData({ statusCodeIndex: e.detail.value }); this.updatePreview() },

  updatePreview() {
    const product = mockData.products.find(p => p._id === this.data.productId)
    const mainZone = this.data.mainZones[this.data.mainZoneIndex]
    const subZone = this.data.subZones[this.data.subZoneIndex]
    const qty = parseInt(this.data.quantity) || 0
    const statusCode = this.data.statusCodes[this.data.statusCodeIndex].code

    if (mainZone && subZone && qty > 0) {
      const seqNumber = product ? product.seq_number : 'XXXX'
      const previewCode = util.generateProductCode(mainZone, subZone, seqNumber, qty, statusCode)
      this.setData({ previewCode })
    } else {
      this.setData({ previewCode: '' })
    }
  },

  // 标签
  onToggleTag(e) {
    const tagId = e.currentTarget.dataset.id
    const selectedTagIds = [...this.data.selectedTagIds]
    const idx = selectedTagIds.indexOf(tagId)
    if (idx > -1) {
      selectedTagIds.splice(idx, 1)
    } else {
      selectedTagIds.push(tagId)
    }
    this.setData({ selectedTagIds })
  },

  onInlineAddTag() {
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
    this.setData({
      allTags: [...mockData.tags],
      selectedTagIds: [...this.data.selectedTagIds, newTag._id],
      showNewTagDialog: false
    })
    wx.showToast({ title: '标签已创建', icon: 'success' })
  },

  onSave() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.quantity || parseInt(this.data.quantity) < 0) {
      wx.showToast({ title: '请输入有效库存数量', icon: 'none' })
      return
    }

    const product = mockData.products.find(p => p._id === this.data.productId)
    if (!product) return

    const mainZone = this.data.mainZones[this.data.mainZoneIndex]
    const subZone = this.data.subZones[this.data.subZoneIndex]
    const statusCode = this.data.statusCodes[this.data.statusCodeIndex].code
    const qty = parseInt(this.data.quantity)

    // 更新编码（序号保持不变，其他部分根据修改更新）
    const code = util.generateProductCode(mainZone, subZone, product.seq_number, qty, statusCode)

    // 更新 mock 数据
    product.name = this.data.name.trim()
    product.original_price = parseFloat(this.data.originalPrice) || 0
    product.market_price = parseFloat(this.data.marketPrice) || 0
    product.expected_price = parseFloat(this.data.expectedPrice) || 0
    product.quantity = qty
    product.storage_location = this.data.storageLocation
    product.remark = this.data.remark
    product.main_zone = mainZone
    product.sub_zone = subZone
    product.status_code = statusCode
    product.code = code
    product.tags = [...this.data.selectedTagIds]
    product.updated_at = new Date().toLocaleString()
    if (this.data.imageUrl) {
      product.image_url = this.data.imageUrl
    }

    wx.showToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 1500)
  }
})
