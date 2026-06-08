const mockData = require('../../utils/mock-data')
const util = require('../../utils/util')

Page({
  data: {
    statusCodes: [],
    availableCodes: [],
    selectedCodeIndex: 0,
    newCodeLabel: '',
    showAddDialog: false
  },

  onLoad() {
    this.setData({ statusCodes: mockData.statusCodes })
    this.updateAvailableCodes()
  },

  updateAvailableCodes() {
    const usedCodes = this.data.statusCodes.map(s => s.code)
    const available = util.ZONES.filter(z => !usedCodes.includes(z))
    this.setData({ availableCodes: available, selectedCodeIndex: 0 })
  },

  onAddCode() {
    this.updateAvailableCodes()
    if (this.data.availableCodes.length === 0) {
      wx.showToast({ title: '已无可用编码', icon: 'none' })
      return
    }
    this.setData({ showAddDialog: true, newCodeLabel: '' })
  },

  hideAddDialog() {
    this.setData({ showAddDialog: false })
  },

  onCodeSelect(e) {
    this.setData({ selectedCodeIndex: e.detail.value })
  },

  onLabelInput(e) {
    this.setData({ newCodeLabel: e.detail.value })
  },

  onConfirmAdd() {
    const code = this.data.availableCodes[this.data.selectedCodeIndex]
    const label = this.data.newCodeLabel.trim()
    if (!label) {
      wx.showToast({ title: '请输入状态名称', icon: 'none' })
      return
    }
    const newCode = {
      _id: 'sc_' + code,
      code,
      label,
      is_system: false,
      owner_openid: 'user_001',
      created_at: new Date().toLocaleString()
    }
    this.setData({
      statusCodes: [...this.data.statusCodes, newCode],
      showAddDialog: false
    })
    this.updateAvailableCodes()
    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  onDeleteCode(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定删除该状态编码吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          const statusCodes = this.data.statusCodes.filter(s => s._id !== id)
          this.setData({ statusCodes })
          this.updateAvailableCodes()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
