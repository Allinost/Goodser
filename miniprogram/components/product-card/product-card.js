const db = require('../../utils/db')
const imgCache = require('../../utils/image-cache')

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
    productTags: [],
    displayImage: '/images/placeholder.png'
  },
  observers: {
    'product': function(product) {
      if (!product) return

      var code = product.status_code
      var status = STATUS_MAP[code] || { label: code, tagClass: 'tag-gray' }

      // 解析标签
      var productTags = (product.tags || []).map(function(tid) {
        return db.tags.find(function(t) { return t._id === tid })
      }).filter(Boolean)

      // 图片缓存：已有本地缓存则直接用，否则异步下载
      var imageUrl = product.image_url || ''
      var displayImage = imgCache.getLocalPath(imageUrl) || imageUrl || '/images/placeholder.png'

      this.setData({
        statusLabel: status.label,
        statusTagClass: status.tagClass,
        productTags: productTags,
        displayImage: displayImage
      })

      // 异步下载图片（如果不在缓存中）
      if (imageUrl && displayImage === imageUrl) {
        var that = this
        var refKey = product._id || ''
        imgCache.cacheImage(imageUrl, refKey).then(function(localPath) {
          if (localPath && localPath !== imageUrl) {
            that.setData({ displayImage: localPath })
          }
        })
      }
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { product: this.properties.product })
    }
  }
})
