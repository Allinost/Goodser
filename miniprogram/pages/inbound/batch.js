const db = require('../../utils/db')
const util = require('../../utils/util')

const COLOR_OPTIONS = [
  '#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#13c2c2',
  '#1890ff', '#2f54eb', '#722ed1', '#eb2f96', '#666666'
]

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    items: [],
    mainZones: util.ZONES,
    subZones: util.ZONES,
    filteredSubZones: util.ZONES,
    statusCodes: [],
    statusCodeLabels: [],
    allTags: [],
    // 当前表单
    currentName: '',
    currentOriginalPrice: '',
    currentMarketPrice: '',
    currentExpectedPrice: '',
    currentQuantity: '',
    currentStorageLocation: '',
    currentRemark: '',
    currentMainZoneIndex: 0,
    currentSubZoneIndex: 0,
    currentStatusCodeIndex: 0,
    currentTagIds: [],
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
      currentName: d.currentName,
      currentOriginalPrice: d.currentOriginalPrice,
      currentMarketPrice: d.currentMarketPrice,
      currentExpectedPrice: d.currentExpectedPrice,
      currentQuantity: d.currentQuantity,
      currentStorageLocation: d.currentStorageLocation,
      currentRemark: d.currentRemark,
      currentMainZoneIndex: d.currentMainZoneIndex,
      currentSubZoneIndex: d.currentSubZoneIndex,
      currentStatusCodeIndex: d.currentStatusCodeIndex,
      currentTagIds: [...d.currentTagIds],
      items: JSON.parse(JSON.stringify(d.items))
    }
  },

  _hasChanges() {
    if (!this._originalData) return false
    var d = this.data
    var o = this._originalData
    if (d.currentName !== o.currentName) return true
    if (d.currentOriginalPrice !== o.currentOriginalPrice) return true
    if (d.currentMarketPrice !== o.currentMarketPrice) return true
    if (d.currentExpectedPrice !== o.currentExpectedPrice) return true
    if (d.currentQuantity !== o.currentQuantity) return true
    if (d.currentStorageLocation !== o.currentStorageLocation) return true
    if (d.currentRemark !== o.currentRemark) return true
    if (d.currentMainZoneIndex !== o.currentMainZoneIndex) return true
    if (d.currentSubZoneIndex !== o.currentSubZoneIndex) return true
    if (d.currentStatusCodeIndex !== o.currentStatusCodeIndex) return true
    if (JSON.stringify(d.currentTagIds) !== JSON.stringify(o.currentTagIds)) return true
    if (JSON.stringify(d.items) !== o.items) return true
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
    this._markDirty()
  },

  // 表单输入
  onCurrentNameInput(e) { this.setData({ currentName: e.detail.value }); this._markDirty() },
  onCurrentOriginalPriceInput(e) { this.setData({ currentOriginalPrice: e.detail.value }); this._markDirty() },
  onCurrentMarketPriceInput(e) { this.setData({ currentMarketPrice: e.detail.value }); this._markDirty() },
  onCurrentExpectedPriceInput(e) { this.setData({ currentExpectedPrice: e.detail.value }); this._markDirty() },
  onCurrentQuantityInput(e) { this.setData({ currentQuantity: e.detail.value }); this._markDirty() },
  onCurrentStorageLocationInput(e) { this.setData({ currentStorageLocation: e.detail.value }); this._markDirty() },
  onCurrentRemarkInput(e) { this.setData({ currentRemark: e.detail.value }); this._markDirty() },
  onCurrentMainZoneChange(e) {
    var idx = e.detail.value
    var filteredSubZones = util.ZONES.slice(idx)
    this.setData({
      currentMainZoneIndex: idx,
      filteredSubZones: filteredSubZones,
      currentSubZoneIndex: 0
    })
    this._markDirty()
  },
  onCurrentSubZoneChange(e) { this.setData({ currentSubZoneIndex: e.detail.value }); this._markDirty() },
  onCurrentStatusCodeChange(e) { this.setData({ currentStatusCodeIndex: e.detail.value }); this._markDirty() },

  // 标签
  onToggleTag(e) {
    const tagId = e.currentTarget.dataset.id
    const currentTagIds = [...this.data.currentTagIds]
    const idx = currentTagIds.indexOf(tagId)
    if (idx > -1) {
      currentTagIds.splice(idx, 1)
    } else {
      currentTagIds.push(tagId)
    }
    this.setData({ currentTagIds })
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
        currentTagIds: [...this.data.currentTagIds, newTagId],
        showNewTagDialog: false
      })
      wx.hideLoading()
      wx.showToast({ title: '标签已创建', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '创建标签失败: ' + err.message, icon: 'none' })
    }
  },

  onAddToBatch() {
    if (!this.data.currentName.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.currentQuantity || parseInt(this.data.currentQuantity) <= 0) {
      wx.showToast({ title: '请输入库存数量', icon: 'none' })
      return
    }
    if (!this.data.statusCodes || this.data.statusCodes.length === 0) {
      wx.showToast({ title: '状态编码数据异常，请返回重试', icon: 'none' })
      return
    }
    const item = {
      id: Date.now(),
      name: this.data.currentName,
      originalPrice: this.data.currentOriginalPrice,
      marketPrice: this.data.currentMarketPrice,
      expectedPrice: this.data.currentExpectedPrice,
      quantity: parseInt(this.data.currentQuantity),
      storageLocation: this.data.currentStorageLocation,
      remark: this.data.currentRemark,
      mainZone: this.data.mainZones[this.data.currentMainZoneIndex],
      subZone: this.data.filteredSubZones[this.data.currentSubZoneIndex],
      statusCode: this.data.statusCodes[this.data.currentStatusCodeIndex].code,
      tagIds: [...this.data.currentTagIds],
      tagNames: this.data.currentTagIds.map(function(tid) {
        var tag = db.tags.find(function(t) { return t._id === tid })
        return tag ? tag.name : ''
      }).filter(Boolean)
    }
    this.setData({
      items: [...this.data.items, item],
      // 重置表单
      currentName: '',
      currentOriginalPrice: '',
      currentMarketPrice: '',
      currentExpectedPrice: '',
      currentQuantity: '',
      currentStorageLocation: '',
      currentRemark: '',
      currentTagIds: []
    })
    this._markDirty()
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.items]
    items.splice(index, 1)
    this.setData({ items })
    this._markDirty()
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  async onSubmit() {
    if (this.data.submitting) return
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请添加商品', icon: 'none' })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    if (!inventory) {
      wx.showToast({ title: '请选择入库目录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认批量入库',
      content: `目录: ${inventory.name}\n共 ${this.data.items.length} 件商品`,
      success: async (modalRes) => {
        if (!modalRes.confirm) return

        this.setData({ submitting: true })
        wx.showLoading({ title: '入库中...', mask: true })

        try {
          const prefix = inventory.name.substring(0, 2).toUpperCase()
          const orderNo = util.generateOrderNo(prefix)
          // 构建批量入库数据
          var batchItems = this.data.items.map(function(item) {
            var seqNumber = util.getNextSeqNumber(db.products, inventory._id, item.mainZone, item.subZone)
            return {
              code: util.generateProductCode(item.mainZone, item.subZone, seqNumber, item.quantity, item.statusCode),
              main_zone: item.mainZone,
              sub_zone: item.subZone,
              seq_number: seqNumber,
              quantity: item.quantity,
              status_code: item.statusCode,
              name: item.name,
              original_price: parseFloat(item.originalPrice) || 0,
              market_price: parseFloat(item.marketPrice) || 0,
              expected_price: parseFloat(item.expectedPrice) || 0,
              remark: item.remark || '',
              storage_location: item.storageLocation || '',
              image_url: '',
              tags: item.tagIds || []
            }
          })
          // 统一入库（产品创建 + 入库日志）
          await db.inboundBatch({
            inventory_id: inventory._id,
            order_no: orderNo,
            items: batchItems
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
          console.error('[批量入库] 失败:', err)
          wx.showToast({ title: '入库失败: ' + (err.message || '未知错误'), icon: 'none', duration: 2500 })
        }
      }
    })
  }
})
