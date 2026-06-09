const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

const PAGE_SIZE = 10

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    currentInventoryId: '',
    orders: [],
    filteredOrders: [],
    pagedOrders: [],
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
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  },

  onLoad() {
    const inventories = mockData.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId: inventories[0]._id,
      inventoryIndex: 0
    })
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  onInventoryChange(e) {
    const index = e.detail.value
    this.setData({
      inventoryIndex: index,
      currentInventoryId: this.data.inventories[index]._id
    })
    this.loadOrders()
  },

  loadOrders() {
    const orders = mockData.outboundOrders.filter(o => o.inventory_id === this.data.currentInventoryId)
    const ordersWithType = orders.map(o => {
      const inv = mockData.inventories.find(i => i._id === o.inventory_id)
      const typeLabel = o.type === 'reserve' ? '预留' : '出库'
      const statusLabel = util.getOrderStatusLabel(o.status)
      return { ...o, _inventoryName: inv ? inv.name : '', _typeLabel: typeLabel, _statusLabel: statusLabel }
    })
    this.setData({ orders: ordersWithType })
    this.applyFilters()
  },

  applyFilters() {
    let list = [...this.data.orders]

    // Tab filter
    if (this.data.activeTab !== 'all') {
      list = list.filter(o => o.type === this.data.activeTab)
    }

    // Status filter
    if (this.data.filterStatus) {
      list = list.filter(o => o.status === this.data.filterStatus)
    }

    // Search
    if (this.data.searchKeyword) {
      const kw = this.data.searchKeyword.toLowerCase()
      list = list.filter(o =>
        (o.order_no || '').toLowerCase().includes(kw) ||
        (o.order_info || '').toLowerCase().includes(kw) ||
        (o.remark || '').toLowerCase().includes(kw) ||
        o.items.some(i => i.product_name.toLowerCase().includes(kw))
      )
    }

    const totalCount = list.length
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
    const currentPage = 1

    this.setData({
      filteredOrders: list,
      totalCount,
      totalPages,
      currentPage
    })
    this.applyPagination()
  },

  applyPagination() {
    const { filteredOrders, currentPage } = this.data
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    this.setData({
      pagedOrders: filteredOrders.slice(start, end)
    })
  },

  onPrevPage() {
    if (this.data.currentPage <= 1) return
    this.setData({ currentPage: this.data.currentPage - 1 })
    this.applyPagination()
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  onNextPage() {
    if (this.data.currentPage >= this.data.totalPages) return
    this.setData({ currentPage: this.data.currentPage + 1 })
    this.applyPagination()
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
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

  onOrderTap(e) {
    const order = e.detail.order
    wx.navigateTo({ url: `/pages/outbound/detail?id=${order._id}` })
  }
})
