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

/**
 * 获取下一个可用序号（自增+回收机制）
 * 查找同目录同分区下已使用的序号，取最大+1
 * 如果中间有空缺（如删除了商品），优先填充最小空缺
 * @param {Array} products - 商品列表
 * @param {string} inventoryId - 目录ID
 * @param {string} mainZone - 主分区
 * @param {string} subZone - 子分区
 * @returns {number} 下一个可用序号
 */
function getNextSeqNumber(products, inventoryId, mainZone, subZone) {
  const usedSeqs = products
    .filter(p => p.inventory_id === inventoryId && p.main_zone === mainZone && p.sub_zone === subZone)
    .map(p => p.seq_number)
    .filter(n => n > 0)
    .sort((a, b) => a - b)

  if (usedSeqs.length === 0) return 1

  // 回收：查找最小空缺位
  for (let i = 1; i <= usedSeqs.length; i++) {
    if (!usedSeqs.includes(i)) {
      return i
    }
  }

  // 无空缺，取最大+1
  return usedSeqs[usedSeqs.length - 1] + 1
}

/**
 * 根据分区、序号、数量、状态生成商品编码
 * @param {string} mainZone
 * @param {string} subZone
 * @param {number} seqNumber
 * @param {number} quantity
 * @param {string} statusCode
 * @returns {string} 编码如 A-A-0001-0025-A
 */
function generateProductCode(mainZone, subZone, seqNumber, quantity, statusCode) {
  const seqStr = String(seqNumber).padStart(4, '0')
  const qtyStr = String(quantity).padStart(4, '0')
  return `${mainZone}-${subZone}-${seqStr}-${qtyStr}-${statusCode}`
}

/**
 * 格式化日期时间，兼容 Date 对象和字符串
 * @param {Date|string|object} date - 日期（可能为 Date 对象、ISO 字符串或 serverDate 对象）
 * @returns {string} 格式如 "2024-01-15 14:30:00"
 */
function formatTime(date) {
  if (!date) return ''
  var d = date
  // 兼容 serverDate 对象
  if (typeof d === 'object' && d instanceof Date === false) {
    try { d = new Date(String(d)) } catch (e) { return '' }
  }
  if (typeof d === 'string' || typeof d === 'number') {
    d = new Date(d)
  }
  if (!(d instanceof Date) || isNaN(d.getTime())) return String(date)
  var Y = d.getFullYear()
  var M = String(d.getMonth() + 1).padStart(2, '0')
  var D = String(d.getDate()).padStart(2, '0')
  var h = String(d.getHours()).padStart(2, '0')
  var m = String(d.getMinutes()).padStart(2, '0')
  var s = String(d.getSeconds()).padStart(2, '0')
  return Y + '-' + M + '-' + D + ' ' + h + ':' + m + ':' + s
}

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
  generateProductCode,
  getNextSeqNumber,
  formatTime,
  ZONES
}
