const mockData = require('../../utils/mock-data')

Page({
  data: {
    statusCodes: [],
    showAddDialog: false,
    newCodeLetter: '',
    newCodeLabel: '',
    codeError: ''
  },

  onLoad() {
    this.setData({ statusCodes: mockData.statusCodes })
  },

  onAddCode() {
    this.setData({
      showAddDialog: true,
      newCodeLetter: '',
      newCodeLabel: '',
      codeError: ''
    })
  },

  hideAddDialog() {
    this.setData({ showAddDialog: false, codeError: '' })
  },

  onCodeInput(e) {
    const val = e.detail.value.toUpperCase()
    this.setData({ newCodeLetter: val, codeError: '' })
  },

  onLabelInput(e) {
    this.setData({ newCodeLabel: e.detail.value })
  },

  onConfirmAdd() {
    const code = this.data.newCodeLetter.trim().toUpperCase()
    const label = this.data.newCodeLabel.trim()

    // 验证编码字母
    if (!code) {
      this.setData({ codeError: '请输入编码字母' })
      return
    }
    if (!/^[A-Z]$/.test(code)) {
      this.setData({ codeError: '只能输入单个大写字母 A-Z' })
      return
    }
    // 检查是否已存在
    if (this.data.statusCodes.some(s => s.code === code)) {
      this.setData({ codeError: `编码 ${code} 已存在` })
      return
    }
    if (!label) {
      wx.showToast({ title: '请输入状态名称', icon: 'none' })
      return
    }

    const newCode = {
      _id: 'sc_' + code + '_' + Date.now(),
      code,
      label,
      is_system: false,
      owner_openid: 'user_001',
      created_at: new Date().toLocaleString()
    }

    mockData.statusCodes.push(newCode)
    this.setData({
      statusCodes: [...mockData.statusCodes],
      showAddDialog: false,
      codeError: ''
    })
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
          const idx = mockData.statusCodes.findIndex(s => s._id === id)
          if (idx > -1) {
            mockData.statusCodes.splice(idx, 1)
          }
          this.setData({ statusCodes: [...mockData.statusCodes] })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
