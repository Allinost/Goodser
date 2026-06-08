const mockData = require('../../utils/mock-data')

Page({
  data: {
    orders: [],
    filteredOrders: [],
    activeTab: 'all'
  },

  onLoad() {
    this.loadOrders()
  },

  onShow() {
    this.loadOrders()
  },

  loadOrders() {
    const orders = mockData.outboundOrders.filter(o => o.inventory_id === 'inv_001')
    this.setData({ orders })
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
