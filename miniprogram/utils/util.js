/**
 * 工具函数
 */

const STATUS_MAP = {
  'A': '正常',
  'B': '预留中',
  'C': '待检',
  'D': '损坏',
  'E': '过期',
  'F': '停用'
}

const STATUS_TAG_CLASS = {
  'A': 'tag-green',
  'B': 'tag-orange',
  'C': 'tag-blue',
  'D': 'tag-red',
  'E': 'tag-gray',
  'F': 'tag-gray'
}

const ORDER_STATUS_MAP = {
  'pending': '待确认',
  'reserved': '预留中',
  'confirmed': '已确认',
  'cancelled': '已取消'
}

const ORDER_STATUS_TAG_CLASS = {
  'pending': 'tag-orange',
  'reserved': 'tag-blue',
  'confirmed': 'tag-green',
  'cancelled': 'tag-gray'
}

function getStatusLabel(code) {
  return STATUS_MAP[code] || code
}

function getStatusTagClass(code) {
  return STATUS_TAG_CLASS[code] || 'tag-gray'
}

function getOrderStatusLabel(status) {
  return ORDER_STATUS_MAP[status] || status
}

function getOrderStatusTagClass(status) {
  return ORDER_STATUS_TAG_CLASS[status] || 'tag-gray'
}

function formatQuantity(product) {
  if (product.reserved_quantity > 0) {
    return `${product.quantity} + ${product.reserved_quantity}`
  }
  return String(product.quantity)
}

function generateOrderNo(prefix) {
  const now = new Date()
  const dateStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('')
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')
  return `${prefix}${dateStr}${seq}`
}

const ZONES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

module.exports = {
  STATUS_MAP,
  STATUS_TAG_CLASS,
  ORDER_STATUS_MAP,
  ORDER_STATUS_TAG_CLASS,
  getStatusLabel,
  getStatusTagClass,
  getOrderStatusLabel,
  getOrderStatusTagClass,
  formatQuantity,
  generateOrderNo,
  ZONES
}
