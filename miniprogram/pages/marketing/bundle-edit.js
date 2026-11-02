const db = require('../../utils/db')

function emptyFilter() {
  return {
    series_id: '',
    set_type_id: '',
    product_type_id: '',
    character_id: '',
    status_code: '',
    keyword: ''
  }
}

Page({
  data: {
    inventoryId: '',
    bundleId: '',
    name: '',
    code: '',
    description: '',
    status: 'active',
    statusOptions: [
      { label: '启用', value: 'active' },
      { label: '停用', value: 'inactive' }
    ],
    statusIndex: 0,
    priceMode: 'sum',
    priceModeOptions: [
      { label: '合计（主商品 + 副区）', value: 'sum' },
      { label: '固定价（单捆）', value: 'fixed' },
      { label: '只收主商品（副区搭配）', value: 'main_only' }
    ],
    priceModeIndex: 0,
    fixedPrice: '',
    minMainQuantity: 1,
    minMainAmount: '',
    minSubQuantity: '',
    maxSubQuantity: '',
    minSubAmount: '',

    filter: emptyFilter(),
    seriesOptions: [{ name: '不限', _id: '' }],
    seriesIndex: 0,
    setTypeOptions: [{ name: '不限', _id: '' }],
    setTypeIndex: 0,
    productTypeOptions: [{ name: '不限', _id: '' }],
    productTypeIndex: 0,
    characterOptions: [{ name: '不限', _id: '' }],
    characterIndex: 0,
    statusCodeOptions: [{ name: '不限', _id: '' }],
    statusCodeIndex: 0,

    mainProducts: [],
    mainKeyword: '',
    mainResults: [],
    subProducts: [],
    subKeyword: '',
    subResults: [],
    submitting: false
  },

  onLoad(options) {
    this.setData({
      inventoryId: options.inventory_id || '',
      bundleId: options.id || ''
    })
    this.loadOptions()
    if (options.id) {
      this.loadBundle(options.id)
    } else {
      wx.setNavigationBarTitle({ title: '新建捆' })
    }
  },

  async loadOptions() {
    try {
      var results = await Promise.all([
        db.loadDictionaries(),
        db.loadStatusCodes()
      ])
      var dictionaries = results[0] || []
      var statusCodes = results[1] || []
      var byKind = function(kind) {
        return dictionaries.filter(function(d) { return d.kind === kind && d.enabled !== false })
      }
      var withEmpty = function(kind) {
        return [{ name: '不限', _id: '' }].concat(byKind(kind).map(function(d) {
          return { name: d.name, _id: d._id }
        }))
      }
      var statusOptions = [{ name: '不限', _id: '' }].concat(statusCodes.map(function(s) {
        return { name: s.code + ' - ' + s.label, _id: s.code }
      }))
      this.setData({
        seriesOptions: withEmpty('series'),
        setTypeOptions: withEmpty('set_type'),
        productTypeOptions: withEmpty('product_type'),
        characterOptions: withEmpty('character'),
        statusCodeOptions: statusOptions
      })
      this._applyFilterIndexes(this.data.filter)
    } catch (err) {
      console.warn('[捆] 加载字典失败:', err)
    }
  },

  _applyFilterIndexes(filter) {
    var indexOf = function(options, value) {
      var idx = options.findIndex(function(o) { return o._id === (value || '') })
      return idx > -1 ? idx : 0
    }
    this.setData({
      seriesIndex: indexOf(this.data.seriesOptions, filter.series_id),
      setTypeIndex: indexOf(this.data.setTypeOptions, filter.set_type_id),
      productTypeIndex: indexOf(this.data.productTypeOptions, filter.product_type_id),
      characterIndex: indexOf(this.data.characterOptions, filter.character_id),
      statusCodeIndex: indexOf(this.data.statusCodeOptions, filter.status_code)
    })
  },

  async loadBundle(id) {
    wx.showLoading({ title: '加载中...' })
    try {
      var bundle = await db.getBundle(id)
      var priceModeIndex = this.data.priceModeOptions.findIndex(function(o) { return o.value === bundle.price_mode })
      var statusIndex = bundle.status === 'inactive' ? 1 : 0
      var mainByID = {}
      ;(bundle.main_products || []).forEach(function(p) { mainByID[p.product_id] = p })
      var mainProducts = (bundle.main_product_ids || []).map(function(pid) {
        var p = mainByID[pid]
        return {
          product_id: pid,
          product_name: p ? p.product_name : pid,
          product_code: p ? p.product_code : ''
        }
      })
      var filter = Object.assign(emptyFilter(), bundle.main_filter || {})
      this.setData({
        name: bundle.name || '',
        code: bundle.code || '',
        description: bundle.description || '',
        status: bundle.status || 'active',
        statusIndex: statusIndex,
        priceMode: bundle.price_mode || 'sum',
        priceModeIndex: priceModeIndex > -1 ? priceModeIndex : 0,
        fixedPrice: bundle.fixed_price ? String(bundle.fixed_price) : '',
        minMainQuantity: bundle.min_main_quantity || 1,
        minMainAmount: bundle.min_main_amount ? String(bundle.min_main_amount) : '',
        minSubQuantity: bundle.min_sub_quantity ? String(bundle.min_sub_quantity) : '',
        maxSubQuantity: bundle.max_sub_quantity ? String(bundle.max_sub_quantity) : '',
        minSubAmount: bundle.min_sub_amount ? String(bundle.min_sub_amount) : '',
        filter: filter,
        mainProducts: mainProducts,
        subProducts: (bundle.sub_products || []).map(function(item) {
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            product_code: item.product_code,
            default_quantity: item.default_quantity || 1,
            available: item.available
          }
        })
      })
      this._applyFilterIndexes(filter)
      wx.setNavigationBarTitle({ title: '编辑捆' })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onCodeInput(e) { this.setData({ code: e.detail.value }) },
  onDescriptionInput(e) { this.setData({ description: e.detail.value }) },
  onFixedPriceInput(e) { this.setData({ fixedPrice: e.detail.value }) },
  onMinMainQuantityInput(e) { this.setData({ minMainQuantity: e.detail.value }) },
  onMinMainAmountInput(e) { this.setData({ minMainAmount: e.detail.value }) },
  onMinSubQuantityInput(e) { this.setData({ minSubQuantity: e.detail.value }) },
  onMaxSubQuantityInput(e) { this.setData({ maxSubQuantity: e.detail.value }) },
  onMinSubAmountInput(e) { this.setData({ minSubAmount: e.detail.value }) },
  onFilterKeywordInput(e) {
    this.setData({ 'filter.keyword': e.detail.value })
  },

  onStatusChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ statusIndex: idx, status: this.data.statusOptions[idx].value })
  },

  onPriceModeChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ priceModeIndex: idx, priceMode: this.data.priceModeOptions[idx].value })
  },

  onSeriesChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ seriesIndex: idx, 'filter.series_id': this.data.seriesOptions[idx]._id })
  },

  onSetTypeChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ setTypeIndex: idx, 'filter.set_type_id': this.data.setTypeOptions[idx]._id })
  },

  onProductTypeChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ productTypeIndex: idx, 'filter.product_type_id': this.data.productTypeOptions[idx]._id })
  },

  onCharacterChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ characterIndex: idx, 'filter.character_id': this.data.characterOptions[idx]._id })
  },

  onStatusCodeChange(e) {
    var idx = Number(e.detail.value)
    this.setData({ statusCodeIndex: idx, 'filter.status_code': this.data.statusCodeOptions[idx]._id })
  },

  onMainKeywordInput(e) {
    this.setData({ mainKeyword: e.detail.value })
    this._debounceSearch('main')
  },

  onSubKeywordInput(e) {
    this.setData({ subKeyword: e.detail.value })
    this._debounceSearch('sub')
  },

  _debounceSearch(kind) {
    if (this._searchTimer) clearTimeout(this._searchTimer)
    var that = this
    this._searchTimer = setTimeout(function() {
      if (kind === 'main') that.searchMainProducts()
      else that.searchSubProducts()
    }, 300)
  },

  async searchMainProducts() {
    var keyword = this.data.mainKeyword.trim()
    if (!keyword || !this.data.inventoryId) {
      this.setData({ mainResults: [] })
      return
    }
    try {
      var res = await db.queryProducts({
        inventory_id: this.data.inventoryId,
        keyword: keyword,
        page: 1,
        page_size: 20
      })
      this.setData({ mainResults: (res && res.items) || [] })
    } catch (err) {
      this.setData({ mainResults: [] })
    }
  },

  async searchSubProducts() {
    var keyword = this.data.subKeyword.trim()
    if (!keyword || !this.data.inventoryId) {
      this.setData({ subResults: [] })
      return
    }
    try {
      var res = await db.queryProducts({
        inventory_id: this.data.inventoryId,
        keyword: keyword,
        page: 1,
        page_size: 20
      })
      this.setData({ subResults: (res && res.items) || [] })
    } catch (err) {
      this.setData({ subResults: [] })
    }
  },

  onAddMainProduct(e) {
    var product = e.currentTarget.dataset.product
    if (!product) return
    if (this.data.mainProducts.some(function(p) { return p.product_id === product._id })) {
      wx.showToast({ title: '已添加该主商品', icon: 'none' })
      return
    }
    this.setData({
      mainProducts: this.data.mainProducts.concat([{
        product_id: product._id,
        product_name: product.name,
        product_code: product.code
      }]),
      mainKeyword: '',
      mainResults: []
    })
  },

  onRemoveMainProduct(e) {
    var list = this.data.mainProducts.slice()
    list.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ mainProducts: list })
  },

  onAddSubProduct(e) {
    var product = e.currentTarget.dataset.product
    if (!product) return
    if (this.data.subProducts.some(function(p) { return p.product_id === product._id })) {
      wx.showToast({ title: '已添加该副区商品', icon: 'none' })
      return
    }
    this.setData({
      subProducts: this.data.subProducts.concat([{
        product_id: product._id,
        product_name: product.name,
        product_code: product.code,
        default_quantity: 1,
        available: product.quantity || 0
      }]),
      subKeyword: '',
      subResults: []
    })
  },

  onRemoveSubProduct(e) {
    var list = this.data.subProducts.slice()
    list.splice(Number(e.currentTarget.dataset.index), 1)
    this.setData({ subProducts: list })
  },

  onSubQtyInput(e) {
    var index = Number(e.currentTarget.dataset.index)
    var list = this.data.subProducts.slice()
    list[index].default_quantity = parseInt(e.detail.value) || 0
    this.setData({ subProducts: list })
  },

  hasFilter() {
    var f = this.data.filter
    return !!(f.series_id || f.set_type_id || f.product_type_id || f.character_id ||
      f.status_code || (f.keyword || '').trim())
  },

  async onSave() {
    if (this.data.submitting) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入捆名称', icon: 'none' })
      return
    }
    if (!this.data.mainProducts.length && !this.hasFilter()) {
      wx.showToast({ title: '请配置显式主商品或主商品筛选条件', icon: 'none' })
      return
    }
    if (!this.data.subProducts.length) {
      wx.showToast({ title: '请至少选择一个副区商品', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    wx.showLoading({ title: '保存中...', mask: true })
    try {
      var f = this.data.filter
      // 始终传对象而非 null：更新时 null 会被后端视为“不修改”，
      // 导致用户清空筛选条件后旧条件仍然存在。
      var filter = {
        series_id: f.series_id || undefined,
        set_type_id: f.set_type_id || undefined,
        product_type_id: f.product_type_id || undefined,
        character_id: f.character_id || undefined,
        status_code: f.status_code || undefined,
        keyword: (f.keyword || '').trim() || undefined
      }
      var payload = {
        name: this.data.name.trim(),
        code: this.data.code.trim() || null,
        description: this.data.description || null,
        status: this.data.status,
        price_mode: this.data.priceMode,
        fixed_price: parseFloat(this.data.fixedPrice) || 0,
        min_main_quantity: parseInt(this.data.minMainQuantity) || 0,
        min_main_amount: parseFloat(this.data.minMainAmount) || 0,
        min_sub_quantity: parseInt(this.data.minSubQuantity) || 0,
        max_sub_quantity: parseInt(this.data.maxSubQuantity) || 0,
        min_sub_amount: parseFloat(this.data.minSubAmount) || 0,
        main_filter: filter,
        main_product_ids: this.data.mainProducts.map(function(p) { return p.product_id }),
        sub_products: this.data.subProducts.map(function(p) {
          return { product_id: p.product_id, default_quantity: Number(p.default_quantity) || 1 }
        })
      }
      if (this.data.bundleId) {
        await db.updateBundle(this.data.bundleId, this.data.inventoryId, payload)
      } else {
        await db.createBundle(this.data.inventoryId, payload)
      }
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(function() { wx.navigateBack() }, 1000)
    } catch (err) {
      wx.hideLoading()
      this.setData({ submitting: false })
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  }
})
