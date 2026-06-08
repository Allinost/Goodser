const STATUS_MAP = {
  'A': { label: '正常', tagClass: 'tag-green' },
  'B': { label: '预留中', tagClass: 'tag-orange' },
  'C': { label: '待检', tagClass: 'tag-blue' },
  'D': { label: '损坏', tagClass: 'tag-red' },
  'E': { label: '过期', tagClass: 'tag-gray' },
  'F': { label: '停用', tagClass: 'tag-gray' }
}

Component({
  properties: {
    product: {
      type: Object,
      value: {}
    }
  },
  data: {
    statusLabel: '',
    statusTagClass: ''
  },
  observers: {
    'product.status_code': function(code) {
      const status = STATUS_MAP[code] || { label: code, tagClass: 'tag-gray' }
      this.setData({
        statusLabel: status.label,
        statusTagClass: status.tagClass
      })
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { product: this.properties.product })
    }
  }
})
