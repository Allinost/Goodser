const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    inventories: [],
    currentInventoryId: 'inv_001',
    currentInventory: {},
    products: [],
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
    filterMainZone: '',
    filterStatus: '',
    mainZones: [],
    statusCodeOptions: []
  },

  onLoad() {
    this.setData({
      inventories: mockData.inventories,
      statusCodeOptions: mockData.statusCodes,
      mainZones: util.ZONES
    })
    this.setCurrentInventory()
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
      list = list.filter(p =>
        p.name.toLowerCase().includes(kw) ||
        p.code.toLowerCase().includes(kw) ||
        p.remark.toLowerCase().includes(kw) ||
        util.getStatusLabel(p.status_code).includes(kw)
      )
    }

    // 筛选 - 主分区
    if (this.data.filterMainZone) {
      list = list.filter(p => p.main_zone === this.data.filterMainZone)
    }

    // 筛选 - 状态
    if (this.data.filterStatus) {
      list = list.filter(p => p.status_code === this.data.filterStatus)
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

    this.setData({ filteredProducts: list })
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

  onResetFilter() {
    this.setData({ filterMainZone: '', filterStatus: '' })
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
    this.setData({ currentInventoryId: id })
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

  // 商品点击
  onProductTap(e) {
    const product = e.detail.product
    wx.navigateTo({ url: `/pages/inventory/detail?id=${product._id}` })
  }
})
