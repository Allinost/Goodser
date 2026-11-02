const db = require('../../utils/db')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    seriesList: [],
    selectedSeries: null,
    products: [],
    loading: false,
    productsLoading: false
  },

  onShow() {
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.loadSeries(true).then(function() {
      wx.stopPullDownRefresh()
    }).catch(function() {
      wx.stopPullDownRefresh()
    })
  },

  async bootstrap() {
    if (!db.isBackendMode()) {
      wx.showModal({
        title: '需要连接后端',
        content: '系列视图需要连接 Go 后端后使用。请先在设置中启用后端服务。',
        showCancel: false
      })
      return
    }
    if (!db.inventories.length) {
      try {
        await db.loadInventories(true)
      } catch (e) {}
    }
    var inventories = db.inventories
    var inventoryIndex = this.data.inventoryIndex
    if (inventoryIndex >= inventories.length) inventoryIndex = 0
    this.setData({
      inventories: inventories,
      inventoryNames: inventories.map(function(i) { return i.name }),
      inventoryIndex: inventoryIndex
    })
    await this.loadSeries()
  },

  currentInventory() {
    return this.data.inventories[this.data.inventoryIndex]
  },

  async loadSeries(force) {
    var inv = this.currentInventory()
    if (!inv) return
    this.setData({ loading: true, selectedSeries: null, products: [] })
    try {
      var list = await db.loadSeriesSummary(inv._id, !!force)
      this.setData({ seriesList: list || [] })
    } catch (err) {
      wx.showToast({ title: err.message || '加载系列失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
    this.loadSeries(true)
  },

  async onSeriesTap(e) {
    var series = this.data.seriesList[Number(e.currentTarget.dataset.index)]
    if (!series) return
    // 再次点击收起
    if (this.data.selectedSeries && this.data.selectedSeries.series_id === series.series_id) {
      this.setData({ selectedSeries: null, products: [] })
      return
    }
    this.setData({ selectedSeries: series, products: [], productsLoading: true })
    try {
      var res = await db.queryProducts({
        inventory_id: this.currentInventory()._id,
        series_id: series.series_id,
        page: 1,
        page_size: 100
      })
      this.setData({ products: (res && res.items) || [] })
    } catch (err) {
      wx.showToast({ title: err.message || '加载商品失败', icon: 'none' })
    } finally {
      this.setData({ productsLoading: false })
    }
  },

  onProductTap(e) {
    var id = e.currentTarget.dataset.id
    var inv = this.currentInventory()
    if (!id || !inv) return
    wx.navigateTo({
      url: '/pages/inventory/detail?id=' + id + '&inv_id=' + inv._id
    })
  }
})
