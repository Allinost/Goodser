const mockData = require('../../utils/mock-data')

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    currentInventoryId: '',
    orders: [],
    filteredOrders: [],
    activeTab: 'all'
  },

  onLoad() {
    const inventories = mockData.inventories
    const inventoryNames = inventories.map(i => i.name)
    this.setData({
      inventories,
      inventoryNames,
      currentInventoryId: inventories[0]._id
    })
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  loadOrders() {
    const orders = mockData.outboundOrders.filter(o => o.inventory_id === this.data.currentInventoryId)
    // 附加库存名称
    const ordersWithInv = orders.map(o => {
      const inv = mockData.inventories.find(i => i._id === o.inventory_id)
      return { ...o, _inventoryName: inv ? inv.name : '' }
    })
    this.setData({ orders: ordersWithInv })
    this.filterOrders()
  },

  filterOrders() {
    let list = [...this.data.orders]
    if (this.data.activeTab !== 'all') {
      list = list.filter(o => o.type === this.data.activeTab)
    }
    this.setData({ filteredOrders: list })
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.filterOrders()
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
