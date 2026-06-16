const util = require('../../utils/util')
const db = require('../../utils/db')

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

  onLoad(options) {
    var that = this
    var statusCodes = [...db.statusCodes]
    var product = db.products.find(function(p) { return p._id === options.id })
    if (!product) {
      // 商品不在本地缓存，尝试从后端加载（Cloud/NAS模式）
      if (db.isBackendMode && db.isBackendMode()) {
        var invId = options.inv_id || (db.inventories.length > 0 ? db.inventories[0]._id : '')
        if (invId) {
          wx.showLoading({ title: '加载中…' })
          db.loadProducts(invId, true).then(function() {
            wx.hideLoading()
            var p = db.products.find(function(p2) { return p2._id === options.id })
            if (p) {
              that._initForm(p, statusCodes)
            } else {
              wx.showToast({ title: '商品不存在', icon: 'none' })
              setTimeout(function() { wx.navigateBack() }, 1500)
            }
          }).catch(function() {
            wx.hideLoading()
            wx.showToast({ title: '商品不存在', icon: 'none' })
            setTimeout(function() { wx.navigateBack() }, 1500)
          })
          return
        }
      }
      wx.showToast({ title: '商品不存在', icon: 'none' })
      setTimeout(function() { wx.navigateBack() }, 1500)
      return
    }
    this._initForm(product, statusCodes)
  },

  /**
   * 从商品对象初始化表单
   */
  _initForm(product, statusCodes) {
    var mainZoneIndex = util.ZONES.indexOf(product.main_zone)
    var subZoneIndex = util.ZONES.indexOf(product.sub_zone)
    var statusCodeIndex = statusCodes.findIndex(function(s) { return s.code === product.status_code })

    // 子分区联动：根据主分区过滤可用的子分区
    var filteredSubZones = util.ZONES.slice(mainZoneIndex > -1 ? mainZoneIndex : 0)
    if (subZoneIndex > -1 && subZoneIndex < mainZoneIndex) {
      subZoneIndex = mainZoneIndex
    }

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
      filteredSubZones: filteredSubZones,
      statusCodes: statusCodes,
      statusCodeLabels: statusCodes.map(function(s) { return s.code + ' - ' + s.label }),
      statusCodeIndex: statusCodeIndex > -1 ? statusCodeIndex : 0,
      allTags: [...db.tags],
      selectedTagIds: [...(product.tags || [])]
    })

    // 保存原始数据用于修改检测
    this._originalData = {
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
      imageUrl: product.image_url || '',
      selectedTagIds: [...(product.tags || [])]
    }

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
        this._markDirty()
      }
    })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }); this._markDirty() },
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
  onSubZoneChange(e) { this.setData({ subZoneIndex: e.detail.value }); this.updatePreview(); this._markDirty() },
  onStatusCodeChange(e) { this.setData({ statusCodeIndex: e.detail.value }); this.updatePreview(); this._markDirty() },

  // 仅当数据真正有修改时才启用离开拦截
  _markDirty() {
    if (this._alertEnabled) return
    if (!this._originalData) return
    if (this.data.name !== this._originalData.name) return this._enableAlert()
    if (this.data.originalPrice !== this._originalData.originalPrice) return this._enableAlert()
    if (this.data.marketPrice !== this._originalData.marketPrice) return this._enableAlert()
    if (this.data.expectedPrice !== this._originalData.expectedPrice) return this._enableAlert()
    if (this.data.quantity !== this._originalData.quantity) return this._enableAlert()
    if (this.data.storageLocation !== this._originalData.storageLocation) return this._enableAlert()
    if (this.data.remark !== this._originalData.remark) return this._enableAlert()
    if (this.data.mainZoneIndex !== this._originalData.mainZoneIndex) return this._enableAlert()
    if (this.data.subZoneIndex !== this._originalData.subZoneIndex) return this._enableAlert()
    if (this.data.statusCodeIndex !== this._originalData.statusCodeIndex) return this._enableAlert()
    if (this.data.imageUrl !== this._originalData.imageUrl) return this._enableAlert()
    if (JSON.stringify(this.data.selectedTagIds) !== JSON.stringify(this._originalData.selectedTagIds)) return this._enableAlert()
  },

  _enableAlert() {
    if (this._alertEnabled) return
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
    const product = db.products.find(p => p._id === this.data.productId)
    const mainZone = this.data.mainZones[this.data.mainZoneIndex]
    const subZone = this.data.filteredSubZones[this.data.subZoneIndex]
    const qty = parseInt(this.data.quantity) || 0
    const statusCode = statusCodes[this.data.statusCodeIndex].code

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
    this._markDirty()
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
      this._markDirty()
      wx.hideLoading()
      wx.showToast({ title: '标签已创建', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建标签失败: ' + err.message, icon: 'none' })
    }
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  async onSave() {
    if (this.data.submitting) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.quantity || parseInt(this.data.quantity) < 0) {
      wx.showToast({ title: '请输入有效库存数量', icon: 'none' })
      return
    }
    if (!this.data.statusCodes || this.data.statusCodes.length === 0) {
      wx.showToast({ title: '状态编码数据异常，请返回重试', icon: 'none' })
      return
    }

    const product = db.products.find(p => p._id === this.data.productId)
    if (!product) return

    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const mainZone = this.data.mainZones[this.data.mainZoneIndex]
      const subZone = this.data.filteredSubZones[this.data.subZoneIndex]
      const statusCode = this.data.statusCodes[this.data.statusCodeIndex].code
      const qty = parseInt(this.data.quantity)

      // 更新编码（序号保持不变，其他部分根据修改更新）
      const code = util.generateProductCode(mainZone, subZone, product.seq_number, qty, statusCode)

      // 通过 API 持久化更新
      await db.updateProduct(this.data.productId, {
        name: this.data.name.trim(),
        original_price: parseFloat(this.data.originalPrice) || 0,
        market_price: parseFloat(this.data.marketPrice) || 0,
        expected_price: parseFloat(this.data.expectedPrice) || 0,
        quantity: qty,
        storage_location: this.data.storageLocation,
        remark: this.data.remark,
        main_zone: mainZone,
        sub_zone: subZone,
        status_code: statusCode,
        code: code,
        tags: [...this.data.selectedTagIds],
        image_url: this.data.imageUrl || product.image_url || ''
      })

      // 关闭离开拦截
      if (this._disableAlert) {
        this._disableAlert()
        this._disableAlert = null
      }

      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 1200)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      console.error('[编辑] 保存失败:', err)
      wx.showToast({ title: '保存失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
    }
  }
})
