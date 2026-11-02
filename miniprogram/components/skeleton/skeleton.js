Component({
  properties: {
    rows: {
      type: Number,
      value: 3,
      observer(value) {
        this.buildItems(value)
      }
    }
  },
  data: {
    items: [0, 1, 2]
  },
  lifetimes: {
    attached() {
      this.buildItems(this.data.rows)
    }
  },
  methods: {
    buildItems(value) {
      var count = Math.max(1, Number(value) || 1)
      var items = []
      for (var i = 0; i < count; i++) items.push(i)
      this.setData({ items: items })
    }
  }
})
