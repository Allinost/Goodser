const db = require('../../utils/db')
const util = require('../../utils/util')

const REASONS = [
  { key: 'return_refund', label: '退货退款', hint: '商品退回并默认回库' },
  { key: 'refund_only', label: '仅退款', hint: '商品不退回，不回库' },
  { key: 'shipping_damage', label: '运损', hint: '运输损坏，可选择是否回库' },
  { key: 'other', label: '其他', hint: '手动选择是否回库' }
]

Page({
  data: {
    inventoryId: '',
    orderId: '',
    loading: true,
    order: null,
    orderSummary: '',
    items: [],
    reasonIndex: 0,
    reasons: REASONS,
    reasonHint: REASONS[0].hint,
    remark: '',
    selectedCount: 0,
    selectedQty: 0,
    submitting: false
  },

  onLoad(options) {
    this.setData({
      inventoryId: options.inventory_id || '',
      orderId: options.order_id || ''
    })
    this.load()
  },

  async load() {
    if (!this.data.inventoryId || !this.data.orderId) {
      this.setData({ loading: false })
      wx.showToast({ title: '缺少出库单参数', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      var list = await db.loadOutboundOrders(this.data.inventoryId, true)
      var orders = (list && list.items) || []
      var order = orders.find(function(o) { return o._id === this.data.orderId }.bind(this))
      if (!order) throw new Error('未找到出库单')

      var returns = await db.loadReturns(this.data.inventoryId, this.data.orderId, true)
      var returnedMap = {}
      ;(returns || []).forEach(function(ret) {
        if (ret.status !== 'pending' && ret.status !== 'confirmed') return
        ;(ret.items || []).forEach(function(item) {
          returnedMap[item.product_id] = (returnedMap[item.product_id] || 0) + (item.quantity || 0)
        })
      })

      var items = (order.items || []).map(function(item) {
        var returned = returnedMap[item.product_id] || 0
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          image_url: item.image_url || '',
          ordered: item.quantity || 0,
          returned: returned,
          remaining: Math.max(0, (item.quantity || 0) - returned),
          selected: false,
          quantity: 0,
          restock: true
        }
      }).filter(function(item) { return item.remaining > 0 })

      var totalQty = (order.items || []).reduce(function(sum, item) { return sum + (item.quantity || 0) }, 0)
      this.setData({
        order: order,
        orderSummary: (order.order_no || '') + ' · 共 ' + totalQty + ' 件',
        items: items,
        loading: false
      })
    } catch (err) {
      console.error('[退货] 加载出库单失败:', err)
      this.setData({ loading: false })
      wx.showModal({
        title: '无法创建退货单',
        content: err.message || '加载出库单失败',
        showCancel: false,
        success: function() { wx.navigateBack() }
      })
    }
  },

  _applyItems(items) {
    var count = 0
    var qty = 0
    for (var i = 0; i < items.length; i++) {
      if (items[i].selected && items[i].quantity > 0) {
        count++
        qty += items[i].quantity
      }
    }
    this.setData({ items: items, selectedCount: count, selectedQty: qty })
  },

  onToggleItem(e) {
    var index = Number(e.currentTarget.dataset.index)
    var items = this.data.items.slice()
    var item = Object.assign({}, items[index])
    item.selected = !item.selected
    item.quantity = item.selected ? Math.min(item.remaining, item.quantity || 1) : 0
    items[index] = item
    this._applyItems(items)
  },

  onMinus(e) {
    var index = Number(e.currentTarget.dataset.index)
    var items = this.data.items.slice()
    var item = Object.assign({}, items[index])
    item.quantity = Math.max(0, (item.quantity || 0) - 1)
    if (item.quantity === 0) item.selected = false
    items[index] = item
    this._applyItems(items)
  },

  onPlus(e) {
    var index = Number(e.currentTarget.dataset.index)
    var items = this.data.items.slice()
    var item = Object.assign({}, items[index])
    item.selected = true
    item.quantity = Math.min(item.remaining, (item.quantity || 0) + 1)
    items[index] = item
    this._applyItems(items)
  },

  onRestockChange(e) {
    var index = Number(e.currentTarget.dataset.index)
    var items = this.data.items.slice()
    var item = Object.assign({}, items[index])
    item.restock = !!e.detail.value
    items[index] = item
    this._applyItems(items)
  },

  onReasonChange(e) {
    var index = Number(e.detail.value)
    var reason = REASONS[index] || REASONS[0]
    var items = this.data.items
    if (reason.key === 'refund_only') {
      items = items.map(function(item) { return Object.assign({}, item, { restock: false }) })
    }
    this.setData({ reasonIndex: index, reasonHint: reason.hint, items: items })
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },

  onSelectAll() {
    var items = this.data.items.map(function(item) {
      if (!item.remaining) return item
      return Object.assign({}, item, { selected: true, quantity: item.quantity || item.remaining })
    })
    this._applyItems(items)
  },

  onClearAll() {
    var items = this.data.items.map(function(item) {
      return Object.assign({}, item, { selected: false, quantity: 0 })
    })
    this._applyItems(items)
  },

  async onSubmit() {
    await this.submit(false)
  },

  async onSubmitAndConfirm() {
    await this.submit(true)
  },

  async submit(confirmAfter) {
    if (this.data.submitting) return
    var reason = REASONS[this.data.reasonIndex] || REASONS[0]
    var selected = this.data.items.filter(function(item) { return item.selected && item.quantity > 0 })
    if (!selected.length) {
      wx.showToast({ title: '请选择要退货的商品', icon: 'none' })
      return
    }
    var over = selected.find(function(item) { return item.quantity > item.remaining })
    if (over) {
      wx.showToast({ title: '退货数量超过可退数量', icon: 'none' })
      return
    }

    var payload = {
      reason: reason.key,
      remark: this.data.remark || undefined,
      items: selected.map(function(item) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          quantity: item.quantity,
          restock: reason.key === 'refund_only' ? false : !!item.restock,
          image_url: item.image_url || undefined
        }
      })
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: confirmAfter ? '创建并确认...' : '提交中...', mask: true })
    try {
      var ret = await db.createReturn(this.data.inventoryId, this.data.orderId, payload)
      if (confirmAfter) {
        await db.confirmReturn(this.data.inventoryId, ret._id)
      }
      wx.hideLoading()
      wx.showToast({ title: confirmAfter ? '已退货并回库' : '退货单已创建', icon: 'success' })
      setTimeout(function() { wx.navigateBack() }, 1000)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '提交失败', icon: 'none', duration: 2500 })
    }
  }
})
