const util = require('../../utils/util')
const mockData = require('../../utils/mock-data')

Page({
  data: {
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
    newTagName: ''
  },

  onLoad() {
    this.setData({ allTags: [...mockData.tags] })
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

  onNameInput(e) { this.setData({ name: e.detail.value }); this.updatePreview() },
  onOriginalPriceInput(e) { this.setData({ originalPrice: e.detail.value }) },
  onMarketPriceInput(e) { this.setData({ marketPrice: e.detail.value }) },
  onExpectedPriceInput(e) { this.setData({ expectedPrice: e.detail.value }) },
  onQuantityInput(e) { this.setData({ quantity: e.detail.value }); this.updatePreview() },
  onStorageLocationInput(e) { this.setData({ storageLocation: e.detail.value }) },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }) },

  onMainZoneChange(e) {
    this.setData({ mainZoneIndex: e.detail.value })
    this.updatePreview()
  },

  onSubZoneChange(e) {
    this.setData({ subZoneIndex: e.detail.value })
    this.updatePreview()
  },

  onStatusCodeChange(e) {
    this.setData({ statusCodeIndex: e.detail.value })
    this.updatePreview()
  },

  updatePreview() {
    const mainZone = this.data.mainZones[this.data.mainZoneIndex]
    const subZone = this.data.subZones[this.data.subZoneIndex]
    const qty = parseInt(this.data.quantity) || 0
    const statusCode = this.data.statusCodes[this.data.statusCodeIndex].code

    if (mainZone && subZone && qty > 0) {
      const qtyStr = String(qty).padStart(4, '0')
      const seqStr = 'XXXX'
      this.setData({
        previewCode: `${mainZone}-${subZone}-${seqStr}-${qtyStr}-${statusCode}`
      })
    } else {
      this.setData({ previewCode: '' })
    }
  },

  // 标签选择
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
    this.setData({ showNewTagDialog: true, newTagName: '' })
  },

  hideNewTagDialog() {
    this.setData({ showNewTagDialog: false })
  },

  onNewTagNameInput(e) {
    this.setData({ newTagName: e.detail.value })
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
      color: '#1890ff',
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

  onSubmit() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.quantity || parseInt(this.data.quantity) <= 0) {
      wx.showToast({ title: '请输入库存数量', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认入库',
      content: `商品: ${this.data.name}\n数量: ${this.data.quantity}`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '入库成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
