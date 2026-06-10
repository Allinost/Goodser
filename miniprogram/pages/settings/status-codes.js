const db = require('../../utils/db')

Page({
  data: {
    statusCodes: [],
    showAddDialog: false,
    newCodeLetter: '',
    newCodeLabel: '',
    codeError: ''
  },

  onLoad() {
    this.setData({ statusCodes: db.statusCodes })
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

  async onConfirmAdd() {
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
    if (db.statusCodes.some(s => s.code === code)) {
      this.setData({ codeError: `编码 ${code} 已存在` })
      return
    }
    if (!label) {
      wx.showToast({ title: '请输入状态名称', icon: 'none' })
      return
    }

    await db.addStatusCode({ code: code, label: label })
    this.setData({
      statusCodes: [...db.statusCodes],
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
      success: async (res) => {
        if (res.confirm) {
          await db.removeStatusCode(id)
          this.setData({ statusCodes: [...db.statusCodes] })
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  }
})
