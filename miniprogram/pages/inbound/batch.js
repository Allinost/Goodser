const mockData = require('../../utils/mock-data')
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
    statusCodes: mockData.statusCodes,
    statusCodeLabels: mockData.statusCodes.map(s => `${s.code} - ${s.label}`),
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
    colorOptions: COLOR_OPTIONS
  },

  onLoad() {
    const inventories = mockData.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({
      inventories,
      inventoryNames,
      allTags: [...mockData.tags]
    })
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
  },

  // 表单输入
  onCurrentNameInput(e) { this.setData({ currentName: e.detail.value }) },
  onCurrentOriginalPriceInput(e) { this.setData({ currentOriginalPrice: e.detail.value }) },
  onCurrentMarketPriceInput(e) { this.setData({ currentMarketPrice: e.detail.value }) },
  onCurrentExpectedPriceInput(e) { this.setData({ currentExpectedPrice: e.detail.value }) },
  onCurrentQuantityInput(e) { this.setData({ currentQuantity: e.detail.value }) },
  onCurrentStorageLocationInput(e) { this.setData({ currentStorageLocation: e.detail.value }) },
  onCurrentRemarkInput(e) { this.setData({ currentRemark: e.detail.value }) },
  onCurrentMainZoneChange(e) { this.setData({ currentMainZoneIndex: e.detail.value }) },
  onCurrentSubZoneChange(e) { this.setData({ currentSubZoneIndex: e.detail.value }) },
  onCurrentStatusCodeChange(e) { this.setData({ currentStatusCodeIndex: e.detail.value }) },

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
      currentTagIds: [...this.data.currentTagIds, newTag._id],
      showNewTagDialog: false
    })
    wx.showToast({ title: '标签已创建', icon: 'success' })
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
    // 获取标签名
    const tagNames = this.data.currentTagIds.map(tid => {
      const tag = mockData.tags.find(t => t._id === tid)
      return tag ? tag.name : ''
    }).filter(Boolean)

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
      subZone: this.data.subZones[this.data.currentSubZoneIndex],
      statusCode: this.data.statusCodes[this.data.currentStatusCodeIndex].code,
      tagIds: [...this.data.currentTagIds],
      tagNames
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
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  onRemoveItem(e) {
    const index = e.currentTarget.dataset.index
    const items = [...this.data.items]
    items.splice(index, 1)
    this.setData({ items })
  },

  onSubmit() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请添加商品', icon: 'none' })
      return
    }
    const inventory = this.data.inventories[this.data.inventoryIndex]
    wx.showModal({
      title: '确认批量入库',
      content: `目录: ${inventory.name}\n共 ${this.data.items.length} 件商品`,
      success: (res) => {
        if (res.confirm) {
          const logItems = []
          this.data.items.forEach(item => {
            const seqNumber = util.getNextSeqNumber(mockData.products, inventory._id, item.mainZone, item.subZone)
            const code = util.generateProductCode(item.mainZone, item.subZone, seqNumber, item.quantity, item.statusCode)
            // 创建商品记录
            const newProduct = {
              _id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              inventory_id: inventory._id,
              code,
              main_zone: item.mainZone,
              sub_zone: item.subZone,
              seq_number: seqNumber,
              quantity: item.quantity,
              reserved_quantity: 0,
              status_code: item.statusCode,
              name: item.name,
              original_price: parseFloat(item.originalPrice) || 0,
              market_price: parseFloat(item.marketPrice) || 0,
              expected_price: parseFloat(item.expectedPrice) || 0,
              remark: item.remark || '',
              storage_location: item.storageLocation || '',
              image_url: '',
              tags: [...item.tagIds],
              owner_openid: 'user_001',
              created_at: new Date().toLocaleString(),
              updated_at: new Date().toLocaleString()
            }
            mockData.products.push(newProduct)
            logItems.push({
              product_id: newProduct._id,
              product_name: item.name,
              product_code: code,
              quantity: item.quantity,
              image_url: ''
            })
          })
          // 创建入库记录
          const prefix = inventory.name.substring(0, 2).toUpperCase()
          const orderNo = util.generateOrderNo(prefix)
          const newLog = {
            _id: 'inlog_' + Date.now(),
            inventory_id: inventory._id,
            order_no: orderNo,
            type: 'batch',
            items: logItems,
            owner_openid: 'user_001',
            created_at: new Date().toLocaleString()
          }
          mockData.inboundLogs.push(newLog)
          wx.showToast({ title: '入库成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
