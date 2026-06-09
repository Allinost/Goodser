const mockData = require('../../utils/mock-data')

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
    statusTagClass: '',
    productTags: []
  },
  observers: {
    'product': function(product) {
      const code = product.status_code
      const status = STATUS_MAP[code] || { label: code, tagClass: 'tag-gray' }

      // 解析标签
      const productTags = (product.tags || []).map(tid => {
        return mockData.tags.find(t => t._id === tid)
      }).filter(Boolean)

      this.setData({
        statusLabel: status.label,
        statusTagClass: status.tagClass,
        productTags
      })
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { product: this.properties.product })
    }
  }
})
