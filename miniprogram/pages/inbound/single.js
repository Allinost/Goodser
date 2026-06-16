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
    filteredSubZones: util.ZONES,
    mainZoneIndex: 0,
    subZoneIndex: 0,
    statusCodes: [],
    statusCodeLabels: [],
    statusCodeIndex: 0,
    previewCode: '',
    allTags: [],
    selectedTagIds: [],
    showNewTagDialog: false,
    newTagName: '',
    newTagColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS,
    submitting: false
  },

  onLoad() {
    this.refreshFormData()
    this._saveOriginal()
  },

  _saveOriginal() {
    var d = this.data
    this._originalData = {
      name: d.name,
      originalPrice: d.originalPrice,
      marketPrice: d.marketPrice,
      expectedPrice: d.expectedPrice,
      quantity: d.quantity,
      storageLocation: d.storageLocation,
      remark: d.remark,
      mainZoneIndex: d.mainZoneIndex,
      subZoneIndex: d.subZoneIndex,
      statusCodeIndex: d.statusCodeIndex,
      imageUrl: d.imageUrl,
      selectedTagIds: [...d.selectedTagIds]
    }
  },

  refreshFormData() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const statusCodes = [...db.statusCodes]
    this.setData({
      inventories,
      inventoryNames,
      allTags: [...db.tags],
      statusCodes: statusCodes,
      statusCodeLabels: statusCodes.map(s => `${s.code} - ${s.label}`)
    })
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
    this.updatePreview()
    this._markDirty()
  },

  onChooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({ imageUrl: res.tempFilePaths[0] })
        this._markDirty()
      }
    })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); this.updatePreview(); this._markDirty() },
  onOriginalPriceInput(e) { this.setData({ originalPrice: e.detail.value }); this._markDirty() },
  onMarketPriceInput(e) { this.setData({ marketPrice: e.detail.value }); this._markDirty() },
  onExpectedPriceInput(e) { this.setData({ expectedPrice: e.detail.value }); this._markDirty() },
  onQuantityInput(e) { this.setData({ quantity: e.detail.value }); this.updatePreview(); this._markDirty() },
  onStorageLocationInput(e) { this.setData({ storageLocation: e.detail.value }); this._markDirty() },
  onRemarkInput(e) { this.setData({ remark: e.detail.value }); this._markDirty() },

  onMainZoneChange(e) {
    var idx = e.detail.value
    var filteredSubZones = util.ZONES.slice(idx)
    this.setData({
      mainZoneIndex: idx,
      filteredSubZones: filteredSubZones,
      subZoneIndex: 0
    })
    this.updatePreview()
    this._markDirty()
  },

  onSubZoneChange(e) {
    this.setData({ subZoneIndex: e.detail.value })
    this.updatePreview()
    this._markDirty()
  },

  onStatusCodeChange(e) {
    this.setData({ statusCodeIndex: e.detail.value })
    this.updatePreview()
    this._markDirty()
  },

  /**
   * 仅在用户有实际输入时才启用离开拦截
   */
  _hasChanges() {
    if (!this._originalData) return false
    var d = this.data
    var o = this._originalData
    if (d.name !== o.name) return true
    if (d.originalPrice !== o.originalPrice) return true
    if (d.marketPrice !== o.marketPrice) return true
    if (d.expectedPrice !== o.expectedPrice) return true
    if (d.quantity !== o.quantity) return true
    if (d.storageLocation !== o.storageLocation) return true
    if (d.remark !== o.remark) return true
    if (d.mainZoneIndex !== o.mainZoneIndex) return true
    if (d.subZoneIndex !== o.subZoneIndex) return true
    if (d.statusCodeIndex !== o.statusCodeIndex) return true
    if (d.imageUrl !== o.imageUrl) return true
    if (JSON.stringify(d.selectedTagIds) !== JSON.stringify(o.selectedTagIds)) return true
    return false
  },

  _markDirty() {
    if (this._alertEnabled) return
    if (!this._hasChanges()) return
    this._alertEnabled = true
    this._disableAlert = wx.enableAlertBeforeUnload({
      message: '当前页面有未保存的修改，确定要离开吗？'
    })
  },

  updatePreview() {
    const statusCodes = this.data.statusCodes
    if (!statusCodes || statusCodes.length === 0) {
      this.setData({ previewCode: '' })
      return
    }
    const mainZone = this.data.mainZones[this.data.mainZoneIndex]
    const subZone = this.data.filteredSubZones[this.data.subZoneIndex]
    const qty = parseInt(this.data.quantity) || 0
    const statusCode = statusCodes[this.data.statusCodeIndex].code

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
    this.enableUnloadAlert()
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
    wx.showLoading({ title: '创建中...' })
    try {
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
      wx.hideLoading()
      wx.showToast({ title: '标签已创建', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建标签失败: ' + err.message, icon: 'none' })
    }
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.quantity || parseInt(this.data.quantity) <= 0) {
      wx.showToast({ title: '请输入库存数量', icon: 'none' })
      return
    }
    if (!this.data.statusCodes || this.data.statusCodes.length === 0) {
      wx.showToast({ title: '状态编码数据异常，请返回重试', icon: 'none' })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    if (!inventory) {
      wx.showToast({ title: '请选择入库目录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认入库',
      content: `目录: ${inventory.name}\n商品: ${this.data.name}\n数量: ${this.data.quantity}`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        this.setData({ submitting: true })
        wx.showLoading({ title: '入库中...', mask: true })

        try {
          const mainZone = this.data.mainZones[this.data.mainZoneIndex]
          const subZone = this.data.filteredSubZones[this.data.subZoneIndex]
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

          // 关闭离开拦截
          if (this._disableAlert) {
            this._disableAlert()
            this._disableAlert = null
          }

          wx.hideLoading()
          wx.showToast({ title: '入库成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1200)
        } catch (err) {
          wx.hideLoading()
          this.setData({ submitting: false })
          console.error('[入库] 失败:', err)
          wx.showToast({ title: '入库失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
        }
      }
    })
  }
})
