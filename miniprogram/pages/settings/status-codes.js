const db = require('../../utils/db')

Page({
  data: {
    statusCodes: [],
    showAddDialog: false,
    newCodeLetter: '',
    newCodeLabel: '',
    codeError: '',
    // 编辑
    showEditDialog: false,
    editId: '',
    editCode: '',
    editLabel: '',
    editError: ''
  },

  onLoad() {
    this.setData({ statusCodes: db.statusCodes })
  },

  onShow() {
    this.setData({ statusCodes: [...db.statusCodes] })
  },

  onAddCode() {
    this.setData({
      showAddDialog: true,
      newCodeLetter: '',
      newCodeLabel: '',
      codeError: ''
    })
  },

  // 阻止弹窗内点击冒泡到遮罩层
  onDialogTap() {},

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

    if (!code) {
      this.setData({ codeError: '请输入编码字母' })
      return
    }
    if (!/^[A-Z]$/.test(code)) {
      this.setData({ codeError: '只能输入单个大写字母 A-Z' })
      return
    }
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

  // ========== 编辑 ==========

  onEditCode(e) {
    const id = e.currentTarget.dataset.id
    var sc = db.statusCodes.find(function(s) { return s._id === id })
    if (!sc) return
    this.setData({
      showEditDialog: true,
      editId: id,
      editCode: sc.code,
      editLabel: sc.label,
      editError: ''
    })
  },

  hideEditDialog() {
    this.setData({ showEditDialog: false, editError: '' })
  },

  onEditLabelInput(e) {
    this.setData({ editLabel: e.detail.value })
  },

  async onConfirmEdit() {
    var label = this.data.editLabel.trim()
    if (!label) {
      this.setData({ editError: '状态名称不能为空' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      await db.updateStatusCode(this.data.editId, { label: label })
      this.setData({
        statusCodes: [...db.statusCodes],
        showEditDialog: false,
        editError: ''
      })
      wx.hideLoading()
      wx.showToast({ title: '更新成功', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '更新失败: ' + (err.message || '未知错误'), icon: 'none' })
    }
  },

  // ========== 删除 ==========

  onDeleteCode(e) {
    const id = e.currentTarget.dataset.id
    var sc = db.statusCodes.find(function(s) { return s._id === id })
    if (!sc) return
    if (sc.is_system) {
      wx.showToast({ title: '系统预设编码不可删除', icon: 'none' })
      return
    }
    // 检查是否有商品正在使用
    var used = db.products.some(function(p) { return p.status_code === sc.code })
    var content = used
      ? '有商品正在使用此编码「' + sc.code + ' - ' + sc.label + '」，删除后相关商品的状态显示可能异常。确定删除吗？'
      : '确定删除编码「' + sc.code + ' - ' + sc.label + '」吗？'
    wx.showModal({
      title: '确认删除',
      content: content,
      confirmColor: '#ff4d4f',
      success: async (res) => {
        if (res.confirm) {
          try {
            await db.removeStatusCode(id)
            this.setData({ statusCodes: [...db.statusCodes] })
            wx.showToast({ title: '已删除', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '删除失败: ' + (err.message || '未知错误'), icon: 'none' })
          }
        }
      }
    })
  }
})
