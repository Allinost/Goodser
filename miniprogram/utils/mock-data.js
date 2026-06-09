/**
 * Goodser Mock 数据
 * 用于开发阶段界面展示
 */

// 库存目录
const inventories = [
  { _id: 'inv_001', name: '默认仓库', owner_openid: 'user_001', sort_order: 0, created_at: '2026-05-01 10:00', updated_at: '2026-06-08 14:00' },
  { _id: 'inv_002', name: '临时仓库', owner_openid: 'user_001', sort_order: 1, created_at: '2026-05-15 09:00', updated_at: '2026-06-07 16:30' },
  { _id: 'inv_003', name: '退货仓', owner_openid: 'user_001', sort_order: 2, created_at: '2026-06-01 11:00', updated_at: '2026-06-06 12:00' }
]

// 商品列表
const products = [
  {
    _id: 'prod_001', inventory_id: 'inv_001',
    code: 'A-A-0001-0025-A', main_zone: 'A', sub_zone: 'A', seq_number: 1,
    quantity: 25, reserved_quantity: 3, status_code: 'A',
    name: '蓝牙耳机 Pro', original_price: 199, market_price: 299, expected_price: 249,
    remark: '热销款，黑色为主', storage_location: 'A区-1架-2层',
    image_url: 'https://picsum.photos/200/200?random=1',
    tags: ['tag_001', 'tag_002', 'tag_005'],
    owner_openid: 'user_001', created_at: '2026-05-01 10:30', updated_at: '2026-06-08 14:20'
  },
  {
    _id: 'prod_002', inventory_id: 'inv_001',
    code: 'A-A-0002-0018-A', main_zone: 'A', sub_zone: 'A', seq_number: 2,
    quantity: 18, reserved_quantity: 0, status_code: 'A',
    name: '无线充电器', original_price: 59, market_price: 99, expected_price: 79,
    remark: '兼容所有Qi设备', storage_location: 'A区-1架-3层',
    image_url: 'https://picsum.photos/200/200?random=2',
    tags: ['tag_005', 'tag_006'],
    owner_openid: 'user_001', created_at: '2026-05-02 09:15', updated_at: '2026-06-07 11:00'
  },
  {
    _id: 'prod_003', inventory_id: 'inv_001',
    code: 'A-B-0001-0012-B', main_zone: 'A', sub_zone: 'B', seq_number: 1,
    quantity: 12, reserved_quantity: 5, status_code: 'B',
    name: '机械键盘 RGB', original_price: 349, market_price: 499, expected_price: 399,
    remark: '青轴，RGB背光', storage_location: 'A区-2架-1层',
    image_url: 'https://picsum.photos/200/200?random=3',
    tags: ['tag_002', 'tag_005'],
    owner_openid: 'user_001', created_at: '2026-05-03 14:00', updated_at: '2026-06-08 09:30'
  },
  {
    _id: 'prod_004', inventory_id: 'inv_001',
    code: 'B-A-0001-0040-A', main_zone: 'B', sub_zone: 'A', seq_number: 1,
    quantity: 40, reserved_quantity: 0, status_code: 'A',
    name: 'USB-C 数据线', original_price: 15, market_price: 29, expected_price: 22,
    remark: '1米长，快充支持', storage_location: 'B区-1架-1层',
    image_url: 'https://picsum.photos/200/200?random=4',
    tags: ['tag_006'],
    owner_openid: 'user_001', created_at: '2026-05-05 16:00', updated_at: '2026-06-06 10:00'
  },
  {
    _id: 'prod_005', inventory_id: 'inv_001',
    code: 'B-A-0002-0008-C', main_zone: 'B', sub_zone: 'A', seq_number: 2,
    quantity: 8, reserved_quantity: 0, status_code: 'C',
    name: '手机支架', original_price: 25, market_price: 49, expected_price: 35,
    remark: '待检批次，需确认质量', storage_location: 'B区-1架-2层',
    image_url: 'https://picsum.photos/200/200?random=5',
    tags: [],
    owner_openid: 'user_001', created_at: '2026-05-08 11:30', updated_at: '2026-06-05 15:00'
  },
  {
    _id: 'prod_006', inventory_id: 'inv_001',
    code: 'B-B-0001-0005-D', main_zone: 'B', sub_zone: 'B', seq_number: 1,
    quantity: 5, reserved_quantity: 0, status_code: 'D',
    name: '移动电源 20000mAh', original_price: 89, market_price: 149, expected_price: 119,
    remark: '外包装有破损', storage_location: 'B区-2架-1层',
    image_url: 'https://picsum.photos/200/200?random=6',
    tags: [],
    owner_openid: 'user_001', created_at: '2026-05-10 08:00', updated_at: '2026-06-04 14:00'
  },
  {
    _id: 'prod_007', inventory_id: 'inv_001',
    code: 'C-A-0001-0100-A', main_zone: 'C', sub_zone: 'A', seq_number: 1,
    quantity: 100, reserved_quantity: 20, status_code: 'A',
    name: '屏幕保护膜', original_price: 5, market_price: 19, expected_price: 12,
    remark: '适用于 iPhone 15 系列', storage_location: 'C区-1架-1层',
    image_url: 'https://picsum.photos/200/200?random=7',
    tags: ['tag_001', 'tag_006'],
    owner_openid: 'user_001', created_at: '2026-05-12 10:00', updated_at: '2026-06-08 16:00'
  },
  {
    _id: 'prod_008', inventory_id: 'inv_001',
    code: 'C-A-0002-0030-A', main_zone: 'C', sub_zone: 'A', seq_number: 2,
    quantity: 30, reserved_quantity: 0, status_code: 'A',
    name: '手机壳 磁吸款', original_price: 18, market_price: 49, expected_price: 35,
    remark: '透明磁吸，多型号', storage_location: 'C区-1架-2层',
    image_url: 'https://picsum.photos/200/200?random=8',
    tags: ['tag_006'],
    owner_openid: 'user_001', created_at: '2026-05-15 09:00', updated_at: '2026-06-07 10:00'
  },
  {
    _id: 'prod_009', inventory_id: 'inv_001',
    code: 'A-C-0001-0015-F', main_zone: 'A', sub_zone: 'C', seq_number: 1,
    quantity: 15, reserved_quantity: 0, status_code: 'F',
    name: '旧款有线耳机', original_price: 39, market_price: 69, expected_price: 49,
    remark: '已停售，清库存', storage_location: 'A区-3架-1层',
    image_url: 'https://picsum.photos/200/200?random=9',
    tags: ['tag_003'],
    owner_openid: 'user_001', created_at: '2026-04-20 14:00', updated_at: '2026-06-01 09:00'
  },
  {
    _id: 'prod_010', inventory_id: 'inv_001',
    code: 'D-A-0001-0050-A', main_zone: 'D', sub_zone: 'A', seq_number: 1,
    quantity: 50, reserved_quantity: 10, status_code: 'A',
    name: 'Type-C 转接头', original_price: 8, market_price: 19, expected_price: 14,
    remark: 'Type-C 转 3.5mm', storage_location: 'D区-1架-1层',
    image_url: 'https://picsum.photos/200/200?random=10',
    tags: ['tag_004', 'tag_006'],
    owner_openid: 'user_001', created_at: '2026-05-20 16:30', updated_at: '2026-06-08 11:00'
  }
]

// 出库单
const outboundOrders = [
  {
    _id: 'out_001', inventory_id: 'inv_001',
    order_no: 'OUT20260608001', type: 'outbound', status: 'pending',
    order_info: '客户订单 #20260608-A', remark: '顺丰快递发货',
    items: [
      { product_id: 'prod_001', product_name: '蓝牙耳机 Pro', product_code: 'A-A-0001-0025-A', quantity: 5, image_url: 'https://picsum.photos/200/200?random=1' },
      { product_id: 'prod_004', product_name: 'USB-C 数据线', product_code: 'B-A-0001-0040-A', quantity: 10, image_url: 'https://picsum.photos/200/200?random=4' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-08 10:00', updated_at: '2026-06-08 10:00',
    confirmed_at: null, cancelled_at: null
  },
  {
    _id: 'out_002', inventory_id: 'inv_001',
    order_no: 'OUT20260607001', type: 'outbound', status: 'confirmed',
    order_info: '客户订单 #20260607-B', remark: '已发货',
    items: [
      { product_id: 'prod_002', product_name: '无线充电器', product_code: 'A-A-0002-0018-A', quantity: 3, image_url: 'https://picsum.photos/200/200?random=2' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-07 09:30', updated_at: '2026-06-07 15:00',
    confirmed_at: '2026-06-07 15:00', cancelled_at: null
  },
  {
    _id: 'rsv_001', inventory_id: 'inv_001',
    order_no: 'RSV20260608001', type: 'reserve', status: 'reserved',
    order_info: '客户预订单 #PRE-20260608', remark: '客户确认后出库',
    items: [
      { product_id: 'prod_003', product_name: '机械键盘 RGB', product_code: 'A-B-0001-0012-B', quantity: 5, image_url: 'https://picsum.photos/200/200?random=3' },
      { product_id: 'prod_007', product_name: '屏幕保护膜', product_code: 'C-A-0001-0100-A', quantity: 20, image_url: 'https://picsum.photos/200/200?random=7' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-08 14:00', updated_at: '2026-06-08 14:00',
    confirmed_at: null, cancelled_at: null
  },
  {
    _id: 'out_003', inventory_id: 'inv_001',
    order_no: 'OUT20260606001', type: 'outbound', status: 'cancelled',
    order_info: '客户订单 #20260606-C', remark: '客户取消订单',
    items: [
      { product_id: 'prod_008', product_name: '手机壳 磁吸款', product_code: 'C-A-0002-0030-A', quantity: 2, image_url: 'https://picsum.photos/200/200?random=8' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-06 11:00', updated_at: '2026-06-06 16:00',
    confirmed_at: null, cancelled_at: '2026-06-06 16:00'
  }
]

// 入库日志
const inboundLogs = [
  {
    _id: 'inlog_001', inventory_id: 'inv_001', type: 'single',
    items: [
      { product_id: 'prod_001', product_name: '蓝牙耳机 Pro', product_code: 'A-A-0001-0025-A', quantity: 25, image_url: 'https://picsum.photos/200/200?random=1' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-08 10:30'
  },
  {
    _id: 'inlog_002', inventory_id: 'inv_001', type: 'batch',
    items: [
      { product_id: 'prod_004', product_name: 'USB-C 数据线', product_code: 'B-A-0001-0040-A', quantity: 40, image_url: 'https://picsum.photos/200/200?random=4' },
      { product_id: 'prod_005', product_name: '手机支架', product_code: 'B-A-0002-0008-C', quantity: 8, image_url: 'https://picsum.photos/200/200?random=5' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-07 09:00'
  },
  {
    _id: 'inlog_003', inventory_id: 'inv_001', type: 'search',
    items: [
      { product_id: 'prod_007', product_name: '屏幕保护膜', product_code: 'C-A-0001-0100-A', quantity: 50, image_url: 'https://picsum.photos/200/200?random=7' }
    ],
    owner_openid: 'user_001', created_at: '2026-06-06 15:00'
  }
]

// 白名单
const whitelist = [
  { _id: 'wl_001', openid: 'user_001', nickname: '管理员', avatar_url: 'https://picsum.photos/100/100?random=101', role: 'admin', added_by: null, created_at: '2026-05-01 10:00' },
  { _id: 'wl_002', openid: 'user_002', nickname: '张三', avatar_url: 'https://picsum.photos/100/100?random=102', role: 'member', added_by: 'user_001', created_at: '2026-05-10 14:00' },
  { _id: 'wl_003', openid: 'user_003', nickname: '李四', avatar_url: 'https://picsum.photos/100/100?random=103', role: 'member', added_by: 'user_001', created_at: '2026-05-20 09:00' }
]

// 状态编码
const statusCodes = [
  { _id: 'sc_A', code: 'A', label: '正常', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'sc_B', code: 'B', label: '预留中', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'sc_C', code: 'C', label: '待检', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'sc_D', code: 'D', label: '损坏', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'sc_E', code: 'E', label: '过期', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'sc_F', code: 'F', label: '停用', is_system: true, owner_openid: 'user_001', created_at: '2026-05-01 10:00' }
]

// 标签（Tag）
const tags = [
  { _id: 'tag_001', name: '热销', color: '#ff4d4f', owner_openid: 'user_001', created_at: '2026-05-01 10:00' },
  { _id: 'tag_002', name: '新品', color: '#1890ff', owner_openid: 'user_001', created_at: '2026-05-05 14:00' },
  { _id: 'tag_003', name: '清仓', color: '#faad14', owner_openid: 'user_001', created_at: '2026-05-10 09:00' },
  { _id: 'tag_004', name: '预售', color: '#722ed1', owner_openid: 'user_001', created_at: '2026-05-15 11:00' },
  { _id: 'tag_005', name: '电子数码', color: '#13c2c2', owner_openid: 'user_001', created_at: '2026-05-20 16:00' },
  { _id: 'tag_006', name: '配件', color: '#52c41a', owner_openid: 'user_001', created_at: '2026-06-01 10:00' }
]

module.exports = {
  inventories,
  products,
  outboundOrders,
  inboundLogs,
  whitelist,
  statusCodes,
  tags
}
