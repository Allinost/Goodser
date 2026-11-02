const db = require('../../utils/db')

Page({
  data: {
    tab: 'combos',
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    combos: [],
    bundles: [],
    loading: false,
    priceModeLabels: {
      sum: '合计计价',
      fixed: '固定价',
      main_only: '只收主商品'
    }
  },

  onShow() {
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.loadData(true).then(function() {
      wx.stopPullDownRefresh()
    }).catch(function() {
      wx.stopPullDownRefresh()
    })
  },

  async bootstrap() {
    if (!db.isBackendMode()) {
      wx.showModal({
        title: '需要连接后端',
        content: '组合包与捆需要连接 Go 后端后使用。请先在设置中启用后端服务。',
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
    await this.loadData()
  },

  currentInventory() {
    return this.data.inventories[this.data.inventoryIndex]
  },

  async loadData(force) {
    var inv = this.currentInventory()
    if (!inv) return
    this.setData({ loading: true })
    try {
      if (this.data.tab === 'combos') {
        var combos = await db.loadCombos(inv._id, !!force)
        this.setData({ combos: combos })
      } else {
        var bundles = await db.loadBundles(inv._id, null, !!force)
        this.setData({ bundles: bundles })
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInventoryChange(e) {
    this.setData({ inventoryIndex: e.detail.value })
    this.loadData(true)
  },

  switchTab(e) {
    var tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab: tab })
    this.loadData()
  },

  openCreateCombo() {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({ url: '/pages/marketing/combo-edit?inventory_id=' + inv._id })
  },

  openEditCombo(e) {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({
      url: '/pages/marketing/combo-edit?inventory_id=' + inv._id + '&id=' + e.currentTarget.dataset.id
    })
  },

  orderCombo(e) {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({
      url: '/pages/outbound/create?inventory_id=' + inv._id + '&combo_id=' + e.currentTarget.dataset.id
    })
  },

  deleteCombo(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name
    var inv = this.currentInventory()
    if (!inv) return
    wx.showModal({
      title: '确认删除',
      content: '确定删除组合包「' + name + '」吗？',
      confirmColor: '#ff4d4f',
      success: async function(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...' })
        try {
          await db.deleteCombo(id, inv._id)
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          that.loadData(true)
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        }
      }
    })
  },

  openCreateBundle() {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({ url: '/pages/marketing/bundle-edit?inventory_id=' + inv._id })
  },

  openEditBundle(e) {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({
      url: '/pages/marketing/bundle-edit?inventory_id=' + inv._id + '&id=' + e.currentTarget.dataset.id
    })
  },

  orderBundle(e) {
    var inv = this.currentInventory()
    if (!inv) return
    wx.navigateTo({
      url: '/pages/marketing/bundle-order?inventory_id=' + inv._id + '&id=' + e.currentTarget.dataset.id
    })
  },

  deleteBundle(e) {
    var that = this
    var id = e.currentTarget.dataset.id
    var name = e.currentTarget.dataset.name
    var inv = this.currentInventory()
    if (!inv) return
    wx.showModal({
      title: '确认删除',
      content: '确定删除捆「' + name + '」吗？',
      confirmColor: '#ff4d4f',
      success: async function(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '删除中...' })
        try {
          await db.deleteBundle(id, inv._id)
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          that.loadData(true)
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '删除失败', icon: 'none' })
        }
      }
    })
  }
})
