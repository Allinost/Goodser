const mockData = require('../../utils/mock-data')
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
    this.setData({
      inventories: mockData.inventories,
      statusCodeOptions: mockData.statusCodes,
      mainZones: util.ZONES,
      tagOptions: mockData.tags
    })
    this.setCurrentInventory()
  },

  onShow() {
    // 刷新标签（可能从设置页新增了标签）
    this.setData({ tagOptions: mockData.tags })
  },

  setCurrentInventory() {
    const inv = this.data.inventories.find(i => i._id === this.data.currentInventoryId)
    this.setData({ currentInventory: inv || this.data.inventories[0] })
    this.loadProducts()
  },

  loadProducts() {
    const products = mockData.products.filter(p => p.inventory_id === this.data.currentInventoryId)
    this.setData({ products })
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
          const tag = mockData.tags.find(t => t._id === tid)
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
    this.setCurrentInventory()
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

  onConfirmAddInventory() {
    const name = this.data.newInventoryName.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    const newInv = {
      _id: 'inv_' + Date.now(),
      name,
      owner_openid: 'user_001',
      sort_order: this.data.inventories.length,
      created_at: new Date().toLocaleString(),
      updated_at: new Date().toLocaleString()
    }
    const inventories = [...this.data.inventories, newInv]
    this.setData({ inventories, showAddDialog: false, currentInventoryId: newInv._id })
    this.setCurrentInventory()
    wx.showToast({ title: '创建成功', icon: 'success' })
  },

  // 删除库存目录
  onDeleteInventory() {
    const hasProducts = mockData.products.some(p => p.inventory_id === this.data.currentInventoryId)
    if (hasProducts) {
      wx.showToast({ title: '该目录下存在商品，无法删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除「${this.data.currentInventory.name}」吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const inventories = this.data.inventories.filter(i => i._id !== this.data.currentInventoryId)
          this.setData({ inventories, currentInventoryId: inventories[0]._id })
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

  onConfirmRename() {
    const name = this.data.renameInventoryName.trim()
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' })
      return
    }
    const inv = this.data.inventories.find(i => i._id === this.data.currentInventoryId)
    if (inv) {
      inv.name = name
      inv.updated_at = new Date().toLocaleString()
      this.setData({ inventories: [...this.data.inventories], currentInventory: { ...inv } })
      wx.showToast({ title: '重命名成功', icon: 'success' })
    }
    this.setData({ showRenameDialog: false })
  },

  // 商品点击
  onProductTap(e) {
    const product = e.detail.product
    wx.navigateTo({ url: `/pages/inventory/detail?id=${product._id}` })
  }
})
