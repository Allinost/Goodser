const db = require('../../utils/db')
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
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    const index = inventories.length > 0 ? 0 : 0
    const currentInventoryId = inventories.length > 0 ? inventories[0]._id : ''
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId: currentInventoryId,
      inventoryIndex: index
    })
    this.loadOrders()
  },

  onShow() {
    // 刷新库存目录列表（可能从库存页面新增/删除/重命名了目录）
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories: inventories,
      inventoryNames: inventoryNames,
      inventoryIndex: index,
      currentInventoryId: currentInventoryId
    })
    this.loadOrders()
  },

  onPullDownRefresh() {
    const inventories = db.inventories
    const inventoryNames = inventories.map(i => i.name)
    let index = this.data.inventoryIndex
    if (index >= inventories.length) index = Math.max(0, inventories.length - 1)
    const currentInventoryId = inventories.length > 0 ? inventories[index]._id : ''
    this.setData({
      inventories: inventories,
      inventoryNames: inventoryNames,
      inventoryIndex: index,
      currentInventoryId: currentInventoryId
    })
    this.loadOrders()
    wx.stopPullDownRefresh()
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
    const orders = db.outboundOrders.filter(o => o.inventory_id === this.data.currentInventoryId)
    const ordersWithType = orders.map(o => {
      const inv = db.inventories.find(i => i._id === o.inventory_id)
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

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  onOrderTap(e) {
    const order = e.detail.order
    wx.navigateTo({ url: `/pages/outbound/detail?id=${order._id}` })
  }
})
