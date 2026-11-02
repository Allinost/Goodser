Component({
  properties: {
    title: {
      type: String,
      value: '加载失败'
    },
    description: {
      type: String,
      value: '请检查网络或后端服务后重试'
    }
  },
  methods: {
    onRetry() {
      this.triggerEvent('retry')
    }
  }
})
