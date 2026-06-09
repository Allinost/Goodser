const mockData = require('../../utils/mock-data')

const COLOR_OPTIONS = [
  '#ff4d4f', '#ff7a45', '#faad14', '#52c41a', '#13c2c2',
  '#1890ff', '#2f54eb', '#722ed1', '#eb2f96', '#666666'
]

Page({
  data: {
    tags: [],
    showDialog: false,
    editingTagId: '',
    tagName: '',
    selectedColor: COLOR_OPTIONS[0],
    colorOptions: COLOR_OPTIONS
  },

  onShow() {
    this.loadTags()
  },

  loadTags() {
    // 统计每个标签下的商品数量
    const tags = mockData.tags.map(tag => {
      const productCount = mockData.products.filter(p =>
        p.tags && p.tags.includes(tag._id)
      ).length
      return { ...tag, productCount }
    })
    this.setData({ tags })
  },

  onAddTag() {
    this.setData({
      showDialog: true,
      editingTagId: '',
      tagName: '',
      selectedColor: COLOR_OPTIONS[0]
    })
  },

  onEditTag(e) {
    const id = e.currentTarget.dataset.id
    const tag = this.data.tags.find(t => t._id === id)
    if (tag) {
      this.setData({
        showDialog: true,
        editingTagId: id,
        tagName: tag.name,
        selectedColor: tag.color
      })
    }
  },

  onDeleteTag(e) {
    const id = e.currentTarget.dataset.id
    const tag = this.data.tags.find(t => t._id === id)
    if (tag && tag.productCount > 0) {
      wx.showToast({ title: '该标签下有商品，无法删除', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除标签「${tag.name}」吗？`,
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const idx = mockData.tags.findIndex(t => t._id === id)
          if (idx > -1) mockData.tags.splice(idx, 1)
          this.loadTags()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  hideDialog() {
    this.setData({ showDialog: false })
  },

  onNameInput(e) {
    this.setData({ tagName: e.detail.value })
  },

  onSelectColor(e) {
    this.setData({ selectedColor: e.currentTarget.dataset.color })
  },

  onConfirmSave() {
    const name = this.data.tagName.trim()
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' })
      return
    }
    // 检查重名
    const duplicate = mockData.tags.find(t =>
      t.name === name && t._id !== this.data.editingTagId
    )
    if (duplicate) {
      wx.showToast({ title: '标签名称已存在', icon: 'none' })
      return
    }

    if (this.data.editingTagId) {
      // 编辑
      const tag = mockData.tags.find(t => t._id === this.data.editingTagId)
      if (tag) {
        tag.name = name
        tag.color = this.data.selectedColor
      }
    } else {
      // 新增
      mockData.tags.push({
        _id: 'tag_' + Date.now(),
        name,
        color: this.data.selectedColor,
        owner_openid: 'user_001',
        created_at: new Date().toLocaleString()
      })
    }
    this.setData({ showDialog: false })
    this.loadTags()
    wx.showToast({ title: '保存成功', icon: 'success' })
  }
})
