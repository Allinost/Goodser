const db = require('../../utils/db')

Page({
  data: {
    inventoryId: '',
    bundleId: '',
    bundle: null,
    mainProductId: '',
    mainOptions: [],
    mainIndex: 0,
    mainQuantity: 1,
    quantity: 1,
    subItems: [],
    preview: null,
    previewError: '',
    previewLoading: false,
    orderInfo: '',
    submitting: false
  },

  onLoad(options) {
    this.setData({
      inventoryId: options.inventory_id || '',
      bundleId: options.id || ''
    })
    this.loadBundle()
  },

  async loadBundle() {
    if (!this.data.bundleId) return
    wx.showLoading({ title: '加载中...' })
    try {
      var bundle = await db.getBundle(this.data.bundleId)
      var mainProducts = bundle.main_products || []
      var main = mainProducts.find(function(p) { return p.available > 0 }) || mainProducts[0]
      var mainIndex = main ? mainProducts.indexOf(main) : 0
      var mainOptions = mainProducts.map(function(p) {
        return {
          product_id: p.product_id,
          label: p.product_name + '（' + p.product_code + ' · 可用 ' + p.available + '）'
        }
      })
      var subItems = (bundle.sub_products || []).map(function(item) {
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          available: item.available,
          quantity: item.default_quantity || 1
        }
      })
      this.setData({
        bundle: bundle,
        mainProductId: main ? main.product_id : '',
        mainOptions: mainOptions,
        mainIndex: mainIndex,
        mainQuantity: bundle.min_main_quantity || 1,
        quantity: 1,
        subItems: subItems
      })
      wx.setNavigationBarTitle({ title: bundle.name || '捆下单' })
      this.refreshPreview()
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onMainChange(e) {
    var index = Number(e.detail.value)
    var main = (this.data.bundle.main_products || [])[index]
    this.setData({ mainIndex: index, mainProductId: main ? main.product_id : '' })
    this.refreshPreview()
  },

  onMainQtyInput(e) {
    this.setData({ mainQuantity: parseInt(e.detail.value) || 1 })
    this.refreshPreview()
  },

  onBundleQtyInput(e) {
    this.setData({ quantity: parseInt(e.detail.value) || 1 })
    this.refreshPreview()
  },

  onSubQtyInput(e) {
    var index = Number(e.currentTarget.dataset.index)
    var subItems = this.data.subItems.slice()
    subItems[index].quantity = parseInt(e.detail.value) || 0
    this.setData({ subItems: subItems })
    this.refreshPreview()
  },

  onOrderInfoInput(e) {
    this.setData({ orderInfo: e.detail.value })
  },

  async refreshPreview() {
    if (!this.data.bundle || !this.data.mainProductId) return
    var that = this
    this.setData({ previewLoading: true, previewError: '', preview: null })
    try {
      var res = await db.previewBundle(this.data.bundleId, {
        main_product_id: this.data.mainProductId,
        main_quantity: Number(this.data.mainQuantity) || 1,
        quantity: Number(this.data.quantity) || 1,
        sub_items: this.data.subItems
          .filter(function(item) { return Number(item.quantity) > 0 })
          .map(function(item) {
            return { product_id: item.product_id, quantity: Number(item.quantity) }
          })
      })
      that.setData({ preview: res })
    } catch (err) {
      that.setData({ previewError: err.message || '捆校验失败' })
    } finally {
      that.setData({ previewLoading: false })
    }
  },

  async onSubmit() {
    if (this.data.submitting) return
    if (!this.data.preview) {
      wx.showToast({ title: '请先完成捆配置并通过校验', icon: 'none' })
      return
    }
    var bundle = this.data.bundle
    var that = this
    wx.showModal({
      title: '确认创建出库单',
      content: '捆：' + bundle.name + '\n数量：' + this.data.quantity + ' 捆\n总价：¥' + this.data.preview.total_price,
      success: async function(modalRes) {
        if (!modalRes.confirm) return
        that.setData({ submitting: true })
        wx.showLoading({ title: '创建中...', mask: true })
        try {
          var ts = new Date()
          var timeStr = ts.getFullYear() + String(ts.getMonth() + 1).padStart(2, '0') + String(ts.getDate()).padStart(2, '0') + String(ts.getHours()).padStart(2, '0') + String(ts.getMinutes()).padStart(2, '0') + String(ts.getSeconds()).padStart(2, '0')
          await db.createOutboundOrder({
            inventory_id: that.data.inventoryId,
            order_no: (that.data.orderInfo || bundle.name) + '_' + timeStr,
            type: 'outbound',
            order_info: that.data.orderInfo,
            remark: '',
            items: [],
            combo_id: null,
            combo_quantity: null,
            bundle: {
              bundle_id: bundle._id,
              main_product_id: that.data.mainProductId,
              main_quantity: Number(that.data.mainQuantity) || 1,
              quantity: Number(that.data.quantity) || 1,
              sub_items: that.data.subItems
                .filter(function(item) { return Number(item.quantity) > 0 })
                .map(function(item) {
                  return { product_id: item.product_id, quantity: Number(item.quantity) }
                })
            }
          })
          wx.hideLoading()
          wx.showToast({ title: '创建成功', icon: 'success' })
          setTimeout(function() { wx.navigateBack() }, 1000)
        } catch (err) {
          wx.hideLoading()
          that.setData({ submitting: false })
          wx.showToast({ title: err.message || '创建失败', icon: 'none' })
        }
      }
    })
  }
})
