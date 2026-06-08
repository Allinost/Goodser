const util = require('../../utils/util')
const mockData = require('../../utils/mock-data')

Page({
  data: {
    items: [],
    mainZones: util.ZONES,
    subZones: util.ZONES,
    statusCodes: mockData.statusCodes,
    statusCodeLabels: mockData.statusCodes.map(s => `${s.code} - ${s.label}`),
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
    currentStatusCodeIndex: 0
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

  onAddToBatch() {
    if (!this.data.currentName.trim()) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!this.data.currentQuantity || parseInt(this.data.currentQuantity) <= 0) {
      wx.showToast({ title: '请输入库存数量', icon: 'none' })
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
      subZone: this.data.subZones[this.data.currentSubZoneIndex],
      statusCode: this.data.statusCodes[this.data.currentStatusCodeIndex].code
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
      currentRemark: ''
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
    wx.showModal({
      title: '确认批量入库',
      content: `共 ${this.data.items.length} 件商品`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '入库成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        }
      }
    })
  }
})
