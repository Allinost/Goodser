const db = require('../../utils/db')

const DAY_OPTIONS = [7, 30, 90, 365]

Page({
  data: {
    inventories: [],
    inventoryNames: [],
    inventoryIndex: 0,
    currentInventoryId: '',
    dayOptions: DAY_OPTIONS,
    dayLabels: ['近 7 天', '近 30 天', '近 90 天', '近 365 天'],
    dayIndex: 0,
    loading: false,
    loadError: '',
    stats: null,
    trend: [],
    selectedTrend: null,
    series: [],
    topProducts: []
  },

  onShow() {
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.loadStats().then(function() {
      wx.stopPullDownRefresh()
    }).catch(function() {
      wx.stopPullDownRefresh()
    })
  },

  async bootstrap() {
    if (!db.isBackendMode()) {
      wx.showModal({
        title: '需要连接后端',
        content: '统计需要连接 Go 后端后使用。请先在设置中配置后端服务。',
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
    if (currentId) await this.loadStats()
  },

  async loadStats() {
    var invId = this.data.currentInventoryId
    if (!invId) return
    var days = this.data.dayOptions[this.data.dayIndex]
    this.setData({ loading: true, loadError: '' })
    try {
      var stats = await db.loadInventoryStats(invId, days)
      var trend = stats.trend || []
      var maxTrend = 1
      trend.forEach(function(p) {
        maxTrend = Math.max(maxTrend, p.outbound_quantity || 0, p.return_quantity || 0)
      })
      trend = trend.map(function(p) {
        return {
          date: p.date,
          label: (p.date || '').slice(5),
          outbound_quantity: p.outbound_quantity || 0,
          return_quantity: p.return_quantity || 0,
          outHeight: p.outbound_quantity ? Math.max(4, Math.round((p.outbound_quantity / maxTrend) * 120)) : 2,
          retHeight: p.return_quantity ? Math.max(4, Math.round((p.return_quantity / maxTrend) * 120)) : 2,
          _selected: false
        }
      })

      var selectedIndex = -1
      for (var i = trend.length - 1; i >= 0; i--) {
        if (trend[i].outbound_quantity || trend[i].return_quantity) {
          selectedIndex = i
          break
        }
      }
      if (selectedIndex < 0 && trend.length) selectedIndex = trend.length - 1
      if (selectedIndex >= 0) trend[selectedIndex]._selected = true
      var selectedTrend = selectedIndex >= 0 ? trend[selectedIndex] : null

      var series = stats.series || []
      var maxSeries = 1
      series.forEach(function(row) { maxSeries = Math.max(maxSeries, row.total || 0) })
      series = series.map(function(row) {
        return Object.assign({}, row, {
          width: Math.max(row.total ? 4 : 0, Math.round(((row.total || 0) / maxSeries) * 100)) + '%',
          stock_value: Number(row.stock_value || 0).toFixed(2)
        })
      })

      var top = (stats.top_products || []).map(function(p, i) {
        return Object.assign({}, p, { rank: i + 1 })
      })
      var stock = stats.stock || {}
      stock.stock_value = Number(stock.stock_value || 0).toFixed(2)

      this.setData({
        loading: false,
        stats: Object.assign({}, stats, { stock: stock }),
        trend: trend,
        selectedTrend: selectedTrend,
        series: series,
        topProducts: top
      })
      wx.setNavigationBarTitle({ title: (stats.inventory_name || '库存') + ' 统计' })
    } catch (err) {
      console.error('[统计] 加载失败:', err)
      this.setData({ loading: false, loadError: err.message || '加载统计失败' })
      wx.showToast({ title: err.message || '加载统计失败', icon: 'none' })
    }
  },

  onTrendTap(e) {
    var index = Number(e.currentTarget.dataset.index)
    var selected = this.data.trend[index]
    if (!selected) return
    this.setData({
      trend: this.data.trend.map(function(item, i) {
        return Object.assign({}, item, { _selected: i === index })
      }),
      selectedTrend: selected
    })
  },

  onRetryLoad() {
    this.loadStats()
  },

  onInventoryChange(e) {
    var index = Number(e.detail.value)
    var inv = this.data.inventories[index]
    this.setData({
      inventoryIndex: index,
      currentInventoryId: inv ? inv._id : ''
    })
    if (inv) this.loadStats()
  },

  onDayChange(e) {
    this.setData({ dayIndex: Number(e.detail.value) })
    this.loadStats()
  }
})
