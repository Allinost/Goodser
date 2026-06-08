/**
 * 生成 TabBar 图标占位文件
 * 运行: node generate-icons.js
 */
const fs = require('fs')
const path = require('path')

// 最小的有效 PNG (1x1 透明像素)
const PNG_HEX = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c48900000000c4944415408d76360f8cf0000000100000149454e44ae426082'
const bytes = Buffer.from(PNG_HEX, 'hex')

const icons = [
  'tab-inventory.png',
  'tab-inventory-active.png',
  'tab-outbound.png',
  'tab-outbound-active.png',
  'tab-inbound.png',
  'tab-inbound-active.png',
  'tab-settings.png',
  'tab-settings-active.png',
  'placeholder.png',
  'icon-search.png',
  'icon-clear.png',
  'empty-inventory.png',
  'empty-outbound.png'
]

const dir = path.join(__dirname, 'miniprogram', 'images')
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

icons.forEach(name => {
  fs.writeFileSync(path.join(dir, name), bytes)
  console.log('Created:', name)
})

console.log('Done! All icons generated.')
