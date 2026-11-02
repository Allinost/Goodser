const db = require('../../utils/db')
const util = require('../../utils/util')

const REASON_LABELS = {
  refund_only: '仅退款',
  return_refund: '退货退款',
  shipping_damage: '运损',
  other: '其他'
}

const STATUS_LABELS = {
  pending: '待确认',
  confirmed: '已确认',
  cancelled: '已取消'
}

const STATUS_CLASSES = {
  pending: 'tag-orange',
  confirmed: 'tag-green',
  cancelled: 'tag-gray'
}

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    currentInventoryId: '',
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'pending', label: '待确认' },
      { key: 'confirmed', label: '已确认' },
      { key: 'cancelled', label: '已取消' }
    ],
    returns: [],
    filteredReturns: [],
    visibleReturns: [],
    searchKeyword: '',
    visibleCount: 20,
    totalCount: 0,
    hasMore: false,
    loadError: '',
    loading: false
  },

  onShow() {
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.loadReturns(true).then(function() {
      wx.stopPullDownRefresh()
    }).catch(function() {
      wx.stopPullDownRefresh()
    })
  },

  async bootstrap() {
    if (!db.isBackendMode()) {
      wx.showModal({
        title: '需要连接后端',
        content: '退货单需要连接 Go 后端后使用。请先在设置中配置后端服务。',
        showCancel: false
      })
      return
    }
    try {
      await db.loadInventories(true)
    } catch (e) {}
    var inventories = db.inventories || []
    var index = this.data.inventoryIndex
    if (index >= inventories.length) index = 0
    var currentId = inventories.length ? inventories[index]._id : ''
    this.setData({
      inventories: inventories,
      inventoryNames: inventories.map(function(i) { return i.name }),
      inventoryIndex: index,
      currentInventoryId: currentId
    })
    if (currentId) await this.loadReturns(true)
  },

  async loadReturns(forceRefresh) {
    var invId = this.data.currentInventoryId
    if (!invId) return
    this.setData({ loading: true, loadError: '' })
    try {
      var list = await db.loadReturns(invId, '', !!forceRefresh)
      var mapped = (list || []).map(function(ret) {
        var items = ret.items || []
        var totalQty = items.reduce(function(sum, item) { return sum + (item.quantity || 0) }, 0)
        var restockQty = items.reduce(function(sum, item) {
          return sum + (item.restock ? (item.quantity || 0) : 0)
        }, 0)
        return Object.assign({}, ret, {
          _reasonLabel: REASON_LABELS[ret.reason] || ret.reason,
          _statusLabel: STATUS_LABELS[ret.status] || ret.status,
          _statusClass: STATUS_CLASSES[ret.status] || 'tag-gray',
          _createdAt: util.formatTime(ret.created_at),
          _totalQty: totalQty,
          _restockQty: restockQty,
          _itemCount: items.length,
          _expanded: false
        })
      })
      this.setData({ returns: mapped })
      this.applyFilter(true)
    } catch (err) {
      console.error('[退货] 加载失败:', err)
      wx.showToast({ title: err.message || '加载退货单失败', icon: 'none' })
      this.setData({
        loadError: err.message || '加载退货单失败',
        returns: [],
        filteredReturns: [],
        visibleReturns: [],
        totalCount: 0,
        hasMore: false
      })
    } finally {
      this.setData({ loading: false })
    }
  },

  applyFilter(reset) {
    var tab = this.data.activeTab
    var keyword = (this.data.searchKeyword || '').trim().toLowerCase()
    var list = this.data.returns
    if (tab !== 'all') {
      list = list.filter(function(ret) { return ret.status === tab })
    }
    if (keyword) {
      list = list.filter(function(ret) {
        if ((ret.order_no || '').toLowerCase().indexOf(keyword) >= 0) return true
        if ((ret.remark || '').toLowerCase().indexOf(keyword) >= 0) return true
        if ((ret._reasonLabel || '').toLowerCase().indexOf(keyword) >= 0) return true
        return (ret.items || []).some(function(item) {
          return (item.product_name || '').toLowerCase().indexOf(keyword) >= 0 ||
            (item.product_code || '').toLowerCase().indexOf(keyword) >= 0
        })
      })
    }
    var visibleCount = reset ? 20 : (this.data.visibleCount + 20)
    if (visibleCount > list.length) visibleCount = list.length
    this.setData({
      filteredReturns: list,
      visibleReturns: list.slice(0, visibleCount),
      visibleCount: visibleCount,
      totalCount: list.length,
      hasMore: visibleCount < list.length
    })
  },

  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value || '' })
    this.applyFilter(true)
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.applyFilter(true)
  },

  onLoadMore() {
    if (!this.data.hasMore) return
    this.applyFilter(false)
  },

  onRetryLoad() {
    this.loadReturns(true)
  },

  onToggleExpand(e) {
    var id = e.currentTarget.dataset.id
    var toggle = function(ret) {
      if (ret._id !== id) return ret
      return Object.assign({}, ret, { _expanded: !ret._expanded })
    }
    this.setData({
      returns: this.data.returns.map(toggle),
      visibleReturns: this.data.visibleReturns.map(toggle)
    })
  },

  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab })
    this.applyFilter(true)
  },

  onInventoryChange(e) {
    var index = Number(e.detail.value)
    var inv = this.data.inventories[index]
    this.setData({
      inventoryIndex: index,
      currentInventoryId: inv ? inv._id : ''
    })
    if (inv) this.loadReturns(true)
  },

  onOutboundTap(e) {
    var ret = e.currentTarget.dataset.ret
    if (!ret || !ret.outbound_order_id) return
    wx.navigateTo({
      url: '/pages/outbound/detail?id=' + ret.outbound_order_id + '&inv_id=' + ret.inventory_id
    })
  },

  onConfirm(e) {
    var ret = e.currentTarget.dataset.ret
    if (!ret) return
    var that = this
    wx.showModal({
      title: '确认退货',
      content: '确认后将按「回库」设置恢复可售库存，且不可撤销。确定继续吗？',
      success: async function(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await db.confirmReturn(ret.inventory_id, ret._id)
          wx.hideLoading()
          wx.showToast({ title: '退货已确认', icon: 'success' })
          await that.loadReturns(true)
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '确认失败', icon: 'none', duration: 2500 })
        }
      }
    })
  },

  onCancel(e) {
    var ret = e.currentTarget.dataset.ret
    if (!ret) return
    var that = this
    wx.showModal({
      title: '取消退货单',
      content: '取消后该退货单不再生效，确定继续吗？',
      confirmColor: '#ff4d4f',
      success: async function(res) {
        if (!res.confirm) return
        wx.showLoading({ title: '处理中...', mask: true })
        try {
          await db.cancelReturn(ret.inventory_id, ret._id)
          wx.hideLoading()
          wx.showToast({ title: '已取消', icon: 'success' })
          await that.loadReturns(true)
        } catch (err) {
          wx.hideLoading()
          wx.showToast({ title: err.message || '取消失败', icon: 'none', duration: 2500 })
        }
      }
    })
  }
})
