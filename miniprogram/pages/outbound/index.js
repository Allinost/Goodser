const db = require('../../utils/db')
const util = require('../../utils/util')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    currentInventoryId: '',
    allOrders: [],
    filteredOrders: [],
    activeTab: 'all',
    searchKeyword: '',
    filterStatus: '',
    statusOptions: [
      { key: '', label: '全部状态' },
      { key: 'pending', label: '待确认' },
      { key: 'reserved', label: '预留中' },
      { key: 'confirmed', label: '已确认' },
      { key: 'cancelled', label: '已取消' }
    ],
    showFilter: false,
    page: 1,
    pageSize: 20,
    hasMore: false,
    loadingMore: false,
    totalCount: 0
  },

  onLoad() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const currentInventoryId = inventories.length > 0 ? inventories[0]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId,
      inventoryIndex: 0
    })
    this.refreshData()
  },

  onShow() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      inventoryIndex: index,
      currentInventoryId
    })
    this.refreshData()
  },

  async onPullDownRefresh() {
    await this.refreshData()
    wx.stopPullDownRefresh()
  },

  async refreshData() {
    if (db.isBackendMode && db.isBackendMode()) {
      await db.loadInventories(true)
    }
    var invs = db.inventories
    var curId = this.data.currentInventoryId
    if (!curId && invs.length > 0) curId = invs[0]._id
    this.setData({ inventories: invs, currentInventoryId: curId, allOrders: [], page: 1, hasMore: false })
    await this.loadPage(1, true)
  },

  async loadPage(pageNum, forceRefresh) {
    const invId = this.data.currentInventoryId
    if (!invId) return
    if (db.isBackendMode && db.isBackendMode()) {
      var opts = forceRefresh ? true : { page: pageNum, page_size: this.data.pageSize }
      var result = await db.loadOutboundOrders(invId, opts)
      var items = result.items || []
      var enriched = items.map(function(o) {
        var inv = db.inventories.find(function(i) { return i._id === o.inventory_id })
        return {
          ...o,
          _inventoryName: inv ? inv.name : '',
          _typeLabel: o.type === 'reserve' ? '预留' : '出库',
          _statusLabel: util.getOrderStatusLabel(o.status)
        }
      })
      if (pageNum === 1) {
        this.setData({ allOrders: enriched, hasMore: result.has_more, page: 1 })
      } else {
        this.setData({
          allOrders: [...this.data.allOrders, ...enriched],
          hasMore: result.has_more,
          page: pageNum
        })
      }
    } else {
      this.loadOrders()
    }
    this.applyFilters()
  },

  async onReachBottom() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    await this.loadPage(this.data.page + 1)
    this.setData({ loadingMore: false })
  },

  onInventoryChange(e) {
    const index = e.detail.value
    this.setData({
      inventoryIndex: index,
      currentInventoryId: this.data.inventories[index]._id
    })
    this.refreshData()
  },

  loadOrders() {
    const orders = db.outboundOrders.filter(o => o.inventory_id === this.data.currentInventoryId)
    const ordersWithType = orders.map(o => {
      const inv = db.inventories.find(i => i._id === o.inventory_id)
      const typeLabel = o.type === 'reserve' ? '预留' : '出库'
      const statusLabel = util.getOrderStatusLabel(o.status)
      return { ...o, _inventoryName: inv ? inv.name : '', _typeLabel: typeLabel, _statusLabel: statusLabel }
    })
    this.setData({ allOrders: ordersWithType })
    this.applyFilters()
  },

  applyFilters() {
    let list = [...this.data.allOrders]

    if (this.data.activeTab !== 'all') {
      list = list.filter(o => o.type === this.data.activeTab)
    }

    if (this.data.filterStatus) {
      list = list.filter(o => o.status === this.data.filterStatus)
    }

    if (this.data.searchKeyword) {
      const kw = this.data.searchKeyword.toLowerCase()
      list = list.filter(o =>
        (o.order_no || '').toLowerCase().includes(kw) ||
        (o.order_info || '').toLowerCase().includes(kw) ||
        (o.remark || '').toLowerCase().includes(kw) ||
        o.items.some(i => i.product_name.toLowerCase().includes(kw))
      )
    }

    this.setData({
      filteredOrders: list,
      totalCount: list.length
    })
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.applyFilters()
  },

  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.applyFilters()
  },

  onFilter() {
    this.setData({ showFilter: true })
  },

  hideFilter() {
    this.setData({ showFilter: false })
  },

  onFilterStatus(e) {
    this.setData({ filterStatus: e.currentTarget.dataset.val })
  },

  onResetFilter() {
    this.setData({ filterStatus: '' })
  },

  onApplyFilter() {
    this.applyFilters()
    this.setData({ showFilter: false })
  },

  onCreateOutbound() {
    wx.navigateTo({ url: '/pages/outbound/create' })
  },

  onCreateReserve() {
    wx.navigateTo({ url: '/pages/outbound/create-reserve' })
  },

  onDialogTap() {},

  onOrderTap(e) {
    const order = e.detail.order
    wx.navigateTo({ url: `/pages/outbound/detail?id=${order._id}` })
  }
})
