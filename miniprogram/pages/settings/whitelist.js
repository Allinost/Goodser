const db = require('../../utils/db')

Page({
  data: {
    whitelist: [],
    showAddDialog: false,
    searchKeyword: ''
  },

  onLoad() {
    this.setData({ whitelist: db.whitelist })
  },

  onShow() {
    this.setData({ whitelist: [...db.whitelist] })
  },

  onAddMember() {
    this.setData({ showAddDialog: true, searchKeyword: '' })
  },

  hideAddDialog() {
    this.setData({ showAddDialog: false })
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
  },

  onSearchUser() {
    if (!this.data.searchKeyword.trim()) {
      wx.showToast({ title: '请输入微信号', icon: 'none' })
      return
    }
    wx.showToast({ title: '搜索功能开发中', icon: 'none' })
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

  onRemoveMember(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定移除该成员吗？',
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          await db.removeWhitelist(id)
          this.setData({ whitelist: [...db.whitelist] })
          wx.showToast({ title: '已移除', icon: 'success' })
        }
      }
    })
  }
})
