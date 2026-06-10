const util = require('../../utils/util')
const db = require('../../utils/db')

const COLOR_OPTIONS = [
  '#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#13c2c2',
  '#1890ff', '#2f54eb', '#722ed1', '#eb2f96', '#666666'
]

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
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
    statusCodes: db.statusCodes,
    statusCodeLabels: db.statusCodes.map(s => `${s.code} - ${s.label}`),
    statusCodeIndex: 0,
    previewCode: '',
    allTags: [],
    selectedTagIds: [],
    showNewTagDialog: false,
    newTagName: '',
    newTagColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS
  },

  onLoad() {
    wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({
      inventories,
      inventoryNames,
      allTags: [...db.tags]
    })
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
    this.updatePreview()
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
      const previewCode = util.generateProductCode(mainZone, subZone, 'XXXX', qty, statusCode)
      this.setData({ previewCode })
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
    this.setData({
      allTags: [...db.tags],
      selectedTagIds: [...this.data.selectedTagIds, newTagId],
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
    const inventory = this.data.inventories[this.data.inventoryIndex]
    wx.showModal({
      title: '确认入库',
      content: `目录: ${inventory.name}\n商品: ${this.data.name}\n数量: ${this.data.quantity}`,
      success: async (res) => {
        if (res.confirm) {
          const mainZone = this.data.mainZones[this.data.mainZoneIndex]
          const subZone = this.data.subZones[this.data.subZoneIndex]
          const statusCode = this.data.statusCodes[this.data.statusCodeIndex].code
          const qty = parseInt(this.data.quantity)

          // 生成序号和编码
          const seqNumber = util.getNextSeqNumber(db.products, inventory._id, mainZone, subZone)
          const code = util.generateProductCode(mainZone, subZone, seqNumber, qty, statusCode)

          // 生成入库单号
          const prefix = inventory.name.substring(0, 2).toUpperCase()
          const orderNo = util.generateOrderNo(prefix)

          // 统一入库（产品创建 + 入库日志）
          await db.inboundSingle({
            inventory_id: inventory._id,
            code: code,
            main_zone: mainZone,
            sub_zone: subZone,
            seq_number: seqNumber,
            quantity: qty,
            status_code: statusCode,
            name: this.data.name.trim(),
            original_price: parseFloat(this.data.originalPrice) || 0,
            market_price: parseFloat(this.data.marketPrice) || 0,
            expected_price: parseFloat(this.data.expectedPrice) || 0,
            remark: this.data.remark.trim(),
            storage_location: this.data.storageLocation.trim(),
            image_url: this.data.imageUrl || '',
            tags: [...this.data.selectedTagIds],
            order_no: orderNo
          })
          wx.showToast({ title: '入库成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
