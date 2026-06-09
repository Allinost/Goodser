const STATUS_MAP = {
  'pending': { label: '待确认', tagClass: 'tag-orange' },
  'reserved': { label: '预留中', tagClass: 'tag-blue' },
  'confirmed': { label: '已确认', tagClass: 'tag-green' },
  'cancelled': { label: '已取消', tagClass: 'tag-gray' }
}

Component({
  properties: {
    order: {
      type: Object,
      value: {}
    }
  },
  data: {
    statusLabel: '',
    statusTagClass: '',
    totalQuantity: 0,
    typeLabel: '',
    typeTagClass: 'order-type-tag-blue'
  },
  observers: {
    'order': function(order) {
      if (!order || !order.items) return
      const status = STATUS_MAP[order.status] || { label: order.status, tagClass: 'tag-gray' }
      const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
      this.setData({
        statusLabel: status.label,
        statusTagClass: status.tagClass,
        totalQuantity,
        typeLabel: order._typeLabel || '',
        typeTagClass: order.type === 'reserve' ? 'order-type-tag-orange' : 'order-type-tag-blue'
      })
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { order: this.properties.order })
    }
  }
})
