const db = require('../../utils/db')
const util = require('../../utils/util')

const PAGE_SIZE = 20

Page({
  data: {
    inventories: [],
    currentInventoryId: 'inv_001',
    currentInventory: {},
    products: [],
    filteredProducts: [],
    pagedProducts: [],
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
    mainZones: [],
    statusCodeOptions: [],
    tagOptions: [],
    // 统计
    totalCount: 0,
    totalStock: 0,
    // 分页
    currentPage: 1,
    totalPages: 1
  },

  onLoad() {
    // 确定有效的库存目录 ID
    var invs = db.inventories
    var curId = this._resolveCurrentInventoryId(this.data.currentInventoryId, invs)

    this.setData({
      inventories: invs,
      currentInventoryId: curId,
      statusCodeOptions: db.statusCodes,
      mainZones: util.ZONES,
      tagOptions: db.tags
    })
    this.setCurrentInventory()

    // Cloud/NAS模式：从后端加载当前目录的商品
    this._loadFromBackend(curId)
  },

  onShow() {
    this.refreshAll()
  },

  onPullDownRefresh() {
    this.refreshAll(function() {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 解析有效的库存目录 ID：如果当前 ID 无效，返回第一个有效 ID
   */
  _resolveCurrentInventoryId(curId, invs) {
    if (curId && invs.length > 0 && !invs.find(function(i) { return i._id === curId })) {
      return invs[0]._id
    }
    if (!curId && invs.length > 0) {
      return invs[0]._id
    }
    return curId || ''
  },

  /**
   * 从后端加载产品数据（Cloud/NAS模式）
   */
  _loadFromBackend(invId) {
    if (!invId) return
    if (!db.isBackendMode || !db.isBackendMode()) return
    var that = this
    db.loadProducts(invId, true).then(function() {
      that.setCurrentInventory()
    }).catch(function(e) {
      console.warn('[Inventory] loadProducts 失败，使用本地数据:', e)
      that.setCurrentInventory()
    })
  },

  async refreshAll(callback) {
    var isBackend = db.isBackendMode && db.isBackendMode()
    var invs = db.inventories
    // 解析有效的库存目录 ID
    var curId = this._resolveCurrentInventoryId(this.data.currentInventoryId, invs)

    this.setData({
      inventories: invs,
      currentInventoryId: curId,
      tagOptions: db.tags,
      statusCodeOptions: db.statusCodes,
      mainZones: util.ZONES
    })

    // Cloud/NAS模式：从数据库强制拉取最新数据
    if (isBackend && curId) {
      try {
        await db.loadProducts(curId, true)
      } catch (e) {
        console.warn('[Inventory] loadProducts 失败，使用缓存数据:', e)
      }
    }

    this.setCurrentInventory()
    if (callback) callback()
  },

  setCurrentInventory() {
    var curId = this.data.currentInventoryId
    var invs = this.data.inventories
    var inv = invs.find(function(i) { return i._id === curId })
    if (!inv && invs.length > 0) {
      // 当前 ID 无效，回退到第一个目录
      inv = invs[0]
      this.setData({ currentInventoryId: inv._id })
    }
    this.setData({ currentInventory: inv || {} })
    this.loadProducts()
  },

  loadProducts() {
    var curId = this.data.currentInventoryId
    var products = db.products.filter(function(p) { return p.inventory_id === curId })
    this.setData({ products: products })
    this.applyFilters()
  },

  applyFilters() {
    let list = [...this.data.products]

    // 搜索
    if (this.data.searchKeyword) {
      const kw = this.data.searchKeyword.toLowerCase()
      list = list.filter(p => {
        // 搜索标签名
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

    // 筛选 - 主分区
    if (this.data.filterMainZone) {
      list = list.filter(p => p.main_zone === this.data.filterMainZone)
    }

    // 筛选 - 状态
    if (this.data.filterStatus) {
      list = list.filter(p => p.status_code === this.data.filterStatus)
    }

    // 筛选 - 标签（OR逻辑：匹配任一标签）
    if (this.data.filterTags.length > 0) {
      list = list.filter(p => {
        const ptags = p.tags || []
        return this.data.filterTags.some(ft => ptags.includes(ft))
      })
    }

    // 排序
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

    // 统计
    const totalCount = this.data.products.length
    const totalStock = list.reduce((sum, p) => sum + (p.quantity || 0), 0)
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))

    // 分页重置到第1页
    const currentPage = 1

    this.setData({
      filteredProducts: list,
      totalCount,
      totalStock,
      totalPages,
      currentPage
    })
    this.applyPagination()
  },

  applyPagination() {
    const { filteredProducts, currentPage } = this.data
    const start = (currentPage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    this.setData({
      pagedProducts: filteredProducts.slice(start, end)
    })
  },

  // 分页
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

  // 搜索
  onSearch(e) {
    this.setData({ searchKeyword: e.detail.value })
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.applyFilters()
  },

  // 排序
  onSort(e) {
    const key = e.currentTarget.dataset.key
    if (this.data.sortBy === key) {
      this.setData({ sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc' })
    } else {
      this.setData({ sortBy: key, sortOrder: 'asc' })
    }
    this.applyFilters()
  },

  // 筛选
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

  onFilterTag(e) {
    const tagId = e.currentTarget.dataset.id
    const filterTags = [...this.data.filterTags]
    const idx = filterTags.indexOf(tagId)
    if (idx > -1) {
      filterTags.splice(idx, 1)
    } else {
      filterTags.push(tagId)
    }
    this.setData({ filterTags })
  },

  onFilterTagClear() {
    this.setData({ filterTags: [] })
  },

  onResetFilter() {
    this.setData({ filterMainZone: '', filterStatus: '', filterTags: [] })
  },

  onApplyFilter() {
    this.applyFilters()
    this.setData({ showFilter: false })
  },

  // 库存目录选择
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
    // Cloud/NAS模式：切换目录时从后端加载产品数据
    if (db.isBackendMode && db.isBackendMode()) {
      db.loadProducts(id, true).then(() => {
        this.setCurrentInventory()
      }).catch(() => {
        this.setCurrentInventory()
      })
    } else {
      this.setCurrentInventory()
    }
    this.setData({ showPicker: false })
  },

  // 新增库存目录
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

  // 删除库存目录
  onDeleteInventory() {
    const hasProducts = db.products.some(p => p.inventory_id === this.data.currentInventoryId)
    if (hasProducts) {
      wx.showToast({ title: '该目录下存在商品，无法删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${this.data.currentInventory.name}」吗？`,
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

  // 重命名库存目录
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

  // 商品点击
  onProductTap(e) {
    const product = e.detail.product
    wx.navigateTo({ url: `/pages/inventory/detail?id=${product._id}&inv_id=${product.inventory_id || ''}` })
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {}
})
