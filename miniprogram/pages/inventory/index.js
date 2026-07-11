const db = require('../../utils/db')
const util = require('../../utils/util')

Page({
  data: {
    inventories: [],
    currentInventoryId: 'inv_001',
    currentInventory: {},
    allProducts: [],
    filteredProducts: [],
    searchKeyword: '',
    sortBy: 'name',
    sortOrder: 'asc',
    sortOptions: [
      { key: 'name', label: '名称' },
      { key: 'main_zone', label: '主分区' },
      { key: 'sub_zone', label: '子分区' },
      { key: 'seq_number', label: '编号' },
      { key: 'quantity', label: '库存' },
      { key: 'status_code', label: '状态' }
    ],
    showPicker: false,
    showFilter: false,
    showAddDialog: false,
    newInventoryName: '',
    showRenameDialog: false,
    renameInventoryName: '',
    filterMainZone: '',
    filterStatus: '',
    filterTags: [],
    filterTagItems: [],
    mainZones: [],
    statusCodeOptions: [],
    tagOptions: [],
    totalCount: 0,
    totalStock: 0,
    page: 1,
    pageSize: 20,
    hasMore: false,
    loadingMore: false
  },

  onLoad() {
    var invs = db.inventories
    var curId = this._resolveCurrentInventoryId(this.data.currentInventoryId, invs)

    this.setData({
      inventories: invs,
      currentInventoryId: curId,
      statusCodeOptions: db.statusCodes,
      mainZones: util.ZONES,
      tagOptions: db.tags,
      filterTagItems: this._buildFilterTagItems(db.tags, [])
    })
    this.setCurrentInventory()
    this.refreshData()
  },

  onShow() {
    this.refreshAll()
  },

  onPullDownRefresh() {
    this.refreshAll(function() {
      wx.stopPullDownRefresh()
    })
  },

  _resolveCurrentInventoryId(curId, invs) {
    if (curId && invs.length > 0 && !invs.find(function(i) { return i._id === curId })) {
      return invs[0]._id
    }
    if (!curId && invs.length > 0) {
      return invs[0]._id
    }
    return curId || ''
  },

  async refreshAll(callback) {
    var isBackend = db.isBackendMode && db.isBackendMode()
    var invs = db.inventories
    var curId = this._resolveCurrentInventoryId(this.data.currentInventoryId, invs)

    this.setData({
      inventories: invs,
      currentInventoryId: curId,
      tagOptions: db.tags,
      filterTagItems: this._buildFilterTagItems(db.tags, this.data.filterTags),
      statusCodeOptions: db.statusCodes,
      mainZones: util.ZONES
    })

    if (isBackend && curId) {
      await this.refreshData()
      this.setCurrentInventory(true)
    } else {
      this.setCurrentInventory()
    }
    if (callback) callback()
  },

  async refreshData() {
    this.setData({ allProducts: [], page: 1, hasMore: false })
    await this.loadPage(1, true)
  },

  async loadPage(pageNum, forceRefresh) {
    const invId = this.data.currentInventoryId
    if (!invId) return
    if (db.isBackendMode && db.isBackendMode()) {
      var opts = forceRefresh ? true : { page: pageNum, page_size: this.data.pageSize }
      var result = await db.loadProducts(invId, opts)
      var items = result.items || []
      if (pageNum === 1) {
        this.setData({ allProducts: items, hasMore: result.has_more, page: 1 })
      } else {
        this.setData({
          allProducts: [...this.data.allProducts, ...items],
          hasMore: result.has_more,
          page: pageNum
        })
      }
    } else {
      this.loadProducts()
    }
    this.applyFilters()
  },

  async onReachBottom() {
    if (this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true })
    await this.loadPage(this.data.page + 1)
    this.setData({ loadingMore: false })
  },

  setCurrentInventory(skipLoad) {
    var curId = this.data.currentInventoryId
    var invs = this.data.inventories
    var inv = invs.find(function(i) { return i._id === curId })
    if (!inv && invs.length > 0) {
      inv = invs[0]
      this.setData({ currentInventoryId: inv._id })
    }
    this.setData({ currentInventory: inv || {} })
    if (!skipLoad) this.loadProducts()
  },

  loadProducts() {
    var curId = this.data.currentInventoryId
    var products = db.products.filter(function(p) { return p.inventory_id === curId })
    this.setData({ allProducts: products })
    this.applyFilters()
  },

  applyFilters() {
    let list = [...this.data.allProducts]

    if (this.data.searchKeyword) {
      const kw = this.data.searchKeyword.toLowerCase()
      list = list.filter(p => {
        const tagNames = (p.tags || []).map(tid => {
          const tag = db.tags.find(t => t._id === tid)
          return tag ? tag.name : ''
        }).join(' ')

        return p.name.toLowerCase().includes(kw) ||
          p.code.toLowerCase().includes(kw) ||
          (p.remark || '').toLowerCase().includes(kw) ||
          util.getStatusLabel(p.status_code).includes(kw) ||
          tagNames.toLowerCase().includes(kw)
      })
    }

    if (this.data.filterMainZone) {
      list = list.filter(p => p.main_zone === this.data.filterMainZone)
    }

    if (this.data.filterStatus) {
      list = list.filter(p => p.status_code === this.data.filterStatus)
    }

    if (this.data.filterTags.length > 0) {
      list = list.filter(p => {
        const ptags = p.tags || []
        return this.data.filterTags.some(ft => ptags.includes(ft))
      })
    }

    const { sortBy, sortOrder } = this.data
    list.sort((a, b) => {
      let va = a[sortBy]
      let vb = b[sortBy]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortOrder === 'asc' ? -1 : 1
      if (va > vb) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    const totalCount = this.data.allProducts.length
    const totalStock = list.reduce((sum, p) => sum + (p.quantity || 0), 0)

    this.setData({
      filteredProducts: list,
      totalCount,
      totalStock
    })
  },

  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.applyFilters()
  },

  onSort(e) {
    const key = e.currentTarget.dataset.key
    if (this.data.sortBy === key) {
      this.setData({ sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      this.setData({ sortBy: key, sortOrder: 'asc' })
    }
    this.applyFilters()
  },

  onFilter() {
    this.setData({ showFilter: true })
  },

  hideFilter() {
    this.setData({ showFilter: false })
  },

  onFilterMainZone(e) {
    this.setData({ filterMainZone: e.currentTarget.dataset.val })
  },

  onFilterStatus(e) {
    this.setData({ filterStatus: e.currentTarget.dataset.val })
  },

  _buildFilterTagItems(tagOptions, filterTags) {
    return tagOptions.map(function(t) {
      return { ...t, _active: filterTags.indexOf(t._id) > -1 }
    })
  },

  onFilterTag(e) {
    const tagId = e.currentTarget.dataset.id
    const filterTags = [...this.data.filterTags]
    const idx = filterTags.indexOf(tagId)
    if (idx > -1) {
      filterTags.splice(idx, 1)
    } else {
      filterTags.push(tagId)
    }
    this.setData({
      filterTags,
      filterTagItems: this._buildFilterTagItems(this.data.tagOptions, filterTags)
    })
  },

  onFilterTagClear() {
    this.setData({
      filterTags: [],
      filterTagItems: this._buildFilterTagItems(this.data.tagOptions, [])
    })
  },

  onResetFilter() {
    this.setData({
      filterMainZone: '',
      filterStatus: '',
      filterTags: [],
      filterTagItems: this._buildFilterTagItems(this.data.tagOptions, [])
    })
  },

  onApplyFilter() {
    this.applyFilters()
    this.setData({ showFilter: false })
  },

  showInventoryPicker() {
    this.setData({ showPicker: true })
  },

  hideInventoryPicker() {
    this.setData({ showPicker: false })
  },

  onSelectInventory(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentInventoryId: id,
      searchKeyword: '',
      filterMainZone: '',
      filterStatus: '',
      filterTags: []
    })
    if (db.isBackendMode && db.isBackendMode()) {
      this.setCurrentInventory(true)
      this.refreshData()
    } else {
      this.setCurrentInventory()
    }
    this.setData({ showPicker: false })
  },

  onAddInventory() {
    this.setData({ showAddDialog: true, newInventoryName: '' })
  },

  hideAddDialog() {
    this.setData({ showAddDialog: false })
  },

  onNewNameInput(e) {
    this.setData({ newInventoryName: e.detail.value })
  },

  async onConfirmAddInventory() {
    const name = this.data.newInventoryName.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    const result = await db.createInventory({ name: name })
    const newInvId = result ? result._id : ('inv_' + Date.now())
    this.setData({ showAddDialog: false, currentInventoryId: newInvId })
    this.setCurrentInventory()
    wx.showToast({ title: '创建成功', icon: 'success' })
  },

  onDeleteInventory() {
    const hasProducts = db.products.some(p => p.inventory_id === this.data.currentInventoryId)
    if (hasProducts) {
      wx.showToast({ title: '该目录下存在商品，无法删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: '确定删除「' + this.data.currentInventory.name + '」吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          await db.deleteInventory(this.data.currentInventoryId)
          var newId = db.inventories.length > 0 ? db.inventories[0]._id : this.data.currentInventoryId
          this.setData({ currentInventoryId: newId })
          this.setCurrentInventory()
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  },

  onRenameInventory() {
    this.setData({ showRenameDialog: true, renameInventoryName: this.data.currentInventory.name })
  },

  hideRenameDialog() {
    this.setData({ showRenameDialog: false })
  },

  onRenameInput(e) {
    this.setData({ renameInventoryName: e.detail.value })
  },

  async onConfirmRename() {
    const name = this.data.renameInventoryName.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    await db.updateInventory(this.data.currentInventoryId, { name: name })
    this.setData({ showRenameDialog: false })
    wx.showToast({ title: '重命名成功', icon: 'success' })
  },

  onProductTap(e) {
    const product = e.detail.product
    wx.navigateTo({ url: '/pages/inventory/detail?id=' + product._id + '&inv_id=' + (product.inventory_id || '') })
  },

  onDialogTap() {}
})
