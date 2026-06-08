Component({
  properties: {
    placeholder: {
      type: String,
      value: '搜索商品名称、编号、备注...'
    },
    value: {
      type: String,
      value: ''
    }
  },
  methods: {
    onInput(e) {
      this.setData({ value: e.detail.value })
      this.triggerEvent('input', { value: e.detail.value })
    },
    onSearch() {
      this.triggerEvent('search', { value: this.data.value })
    },
    onClear() {
      this.setData({ value: '' })
      this.triggerEvent('clear')
      this.triggerEvent('search', { value: '' })
    }
  }
})
