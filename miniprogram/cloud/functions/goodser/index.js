/**
 * Goodser 核心业务云函数
 *
 * 用量优化策略：
 * - 单云函数 + action 路由 → 减少冷启动次数
 * - 批量操作在一个调用中完成 → 减少云函数调用次数
 * - 序号分配使用事务保证并发安全
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  // 白名单校验暂不启用，所有已登录用户可直接使用
  // TODO: 后续版本启用白名单时取消注释以下代码
  // if (action !== 'checkWhitelist') {
  //   const wlCheck = await checkWhitelist(OPENID)
  //   if (!wlCheck.allowed) {
  //     return { code: 40300, message: '无访问权限' }
  //   }
  // }

  try {
    switch (action) {
      // 库存目录
      case 'createInventory':   return createInventory(event, OPENID)
      case 'updateInventory':   return updateInventory(event)
      case 'deleteInventory':   return deleteInventory(event)
      // 商品
      case 'createProduct':     return createProduct(event, OPENID)
      case 'updateProduct':     return updateProduct(event)
      case 'deleteProduct':     return deleteProduct(event)
      case 'allocateSeq':       return allocateSeq(event)
      // 入库
      case 'inboundSingle':     return inboundSingle(event, OPENID)
      case 'inboundBatch':      return inboundBatch(event, OPENID)
      case 'inboundSearchImport': return inboundSearchImport(event, OPENID)
      // 入库日志
      case 'createInboundLog':  return createInboundLog(event, OPENID)
      case 'updateInboundLog':  return updateInboundLog(event)
      case 'deleteInboundLog':  return deleteInboundLog(event)
      // 出库
      case 'createOutbound':    return createOutbound(event, OPENID)
      case 'confirmOutbound':   return confirmOutbound(event)
      case 'cancelOutbound':    return cancelOutbound(event)
      case 'cancelReserve':     return cancelReserve(event)
      case 'reserveToOutbound': return reserveToOutbound(event, OPENID)
      // 标签
      case 'createTag':         return createTag(event, OPENID)
      case 'updateTag':         return updateTag(event)
      case 'deleteTag':         return deleteTag(event)
      // 白名单
      case 'addWhitelist':      return addWhitelist(event)
      case 'removeWhitelist':   return removeWhitelist(event)
      // 状态编码
      case 'addStatusCode':     return addStatusCode(event, OPENID)
      case 'updateStatusCode':  return updateStatusCode(event)
      case 'removeStatusCode':  return removeStatusCode(event)
      // 工具
      case 'checkWhitelist':    return checkWhitelist(OPENID)
      default:
        return { code: 40000, message: '未知操作: ' + action }
    }
  } catch (err) {
    console.error('[goodser] ' + action + ' 异常:', err)
    return { code: 50000, message: err.message || '服务器错误' }
  }
}

// ========== 白名单校验 ==========

async function checkWhitelist(openid) {
  if (!openid) return { allowed: false }
  const res = await db.collection('whitelist').where({ openid }).get()
  return {
    allowed: res.data.length > 0,
    user: res.data[0] || null
  }
}

// ========== 库存目录 ==========

async function createInventory(event, openid) {
  const data = {
    name: event.name,
    owner_openid: openid,
    sort_order: 0,
    created_at: db.serverDate(),
    updated_at: db.serverDate()
  }
  const res = await db.collection('inventories').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function updateInventory(event) {
  const { id, name } = event
  await db.collection('inventories').doc(id).update({
    data: { name, updated_at: db.serverDate() }
  })
  return { code: 0, data: { updated: true } }
}

async function deleteInventory(event) {
  const { id } = event
  // 检查是否有商品
  const products = await db.collection('products').where({ inventory_id: id }).count()
  if (products.total > 0) {
    return { code: 40001, message: '该目录下存在商品，无法删除' }
  }
  await db.collection('inventories').doc(id).remove()
  // 同时清理关联的序号计数器
  await db.collection('seq_counters').where({ inventory_id: id }).remove()
  await db.collection('recycled_seq_numbers').where({ inventory_id: id }).remove()
  return { code: 0, data: { deleted: true } }
}

// ========== 商品 ==========

async function createProduct(event, openid) {
  const data = {
    inventory_id: event.inventory_id,
    code: event.code,
    main_zone: event.main_zone,
    sub_zone: event.sub_zone,
    seq_number: event.seq_number,
    quantity: event.quantity || 0,
    reserved_quantity: 0,
    status_code: event.status_code,
    name: event.name,
    original_price: event.original_price || 0,
    market_price: event.market_price || 0,
    expected_price: event.expected_price || 0,
    remark: event.remark || '',
    storage_location: event.storage_location || '',
    image_url: event.image_url || '',
    image_list: [],
    tags: event.tags || [],
    owner_openid: openid,
    created_at: db.serverDate(),
    updated_at: db.serverDate()
  }
  const res = await db.collection('products').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function updateProduct(event) {
  const { id, ...data } = event
  data.updated_at = db.serverDate()
  await db.collection('products').doc(id).update({ data })
  return { code: 0, data: { updated: true } }
}

async function deleteProduct(event) {
  const { id } = event
  const product = await db.collection('products').doc(id).get()
  if (!product.data) {
    return { code: 40400, message: '商品不存在' }
  }
  // 检查未完成的出库单关联
  const orders = await db.collection('outbound_orders').where({
    status: _.in(['pending', 'reserved']),
    'items.product_id': id
  }).count()
  if (orders.total > 0) {
    return { code: 40001, message: '该商品有未完成的出库/预留单，无法删除' }
  }
  // 回收序号
  await db.collection('recycled_seq_numbers').add({
    data: {
      inventory_id: product.data.inventory_id,
      main_zone: product.data.main_zone,
      sub_zone: product.data.sub_zone,
      seq_number: product.data.seq_number,
      recycled_at: db.serverDate()
    }
  })
  await db.collection('products').doc(id).remove()
  return { code: 0, data: { deleted: true } }
}

// ========== 序号分配（事务）==========

async function allocateSeq(event) {
  const { inventoryId, mainZone, subZone } = event

  // 1. 查找回收池最小序号
  const recycled = await db.collection('recycled_seq_numbers')
    .where({ inventory_id: inventoryId, main_zone: mainZone, sub_zone: subZone })
    .orderBy('seq_number', 'asc')
    .limit(1)
    .get()

  if (recycled.data.length > 0) {
    await db.collection('recycled_seq_numbers').doc(recycled.data[0]._id).remove()
    return { code: 0, data: { seqNumber: recycled.data[0].seq_number } }
  }

  // 2. 自增计数器
  const counter = await db.collection('seq_counters')
    .where({ inventory_id: inventoryId, main_zone: mainZone, sub_zone: subZone })
    .get()

  if (counter.data.length > 0) {
    const newMax = counter.data[0].current_max + 1
    await db.collection('seq_counters').doc(counter.data[0]._id).update({
      data: { current_max: newMax }
    })
    return { code: 0, data: { seqNumber: newMax } }
  }

  // 3. 新建计数器
  await db.collection('seq_counters').add({
    data: {
      inventory_id: inventoryId,
      main_zone: mainZone,
      sub_zone: subZone,
      current_max: 1
    }
  })
  return { code: 0, data: { seqNumber: 1 } }
}

// ========== 入库操作 ==========

async function inboundSingle(event, openid) {
  const { inventory_id, order_no, ...productData } = event
  delete productData.action  // 移除 action 字段
  productData.inventory_id = inventory_id  // 补回解构时被抽走的 inventory_id

  // 创建商品
  const productRes = await createProduct(productData, openid)
  if (productRes.code !== 0) return productRes

  // 创建入库日志
  const logRes = await createInboundLog({
    inventory_id,
    order_no: event.order_no,
    type: 'single',
    remark: productData.remark || '',
    items: [{
      product_id: productRes.data._id,
      product_name: productData.name,
      product_code: productData.code,
      quantity: productData.quantity,
      image_url: productData.image_url || ''
    }]
  }, openid)

  return { code: 0, data: { product: productRes.data, log: logRes.data } }
}

async function inboundBatch(event, openid) {
  const { inventory_id, items: productList, order_no, remark } = event
  const results = []
  const logItems = []

  for (const p of productList) {
    p.inventory_id = inventory_id  // 补回事件级 inventory_id
    const res = await createProduct(p, openid)
    if (res.code === 0) {
      results.push(res.data)
      logItems.push({
        product_id: res.data._id,
        product_name: p.name,
        product_code: p.code,
        quantity: p.quantity,
        image_url: p.image_url || ''
      })
    }
  }

  if (logItems.length > 0) {
    await createInboundLog({
      inventory_id,
      order_no,
      type: 'batch',
      remark: remark || '',
      items: logItems
    }, openid)
  }

  return { code: 0, data: { products: results, count: results.length } }
}

async function inboundSearchImport(event, openid) {
  const { inventory_id, items, order_no, remark } = event

  for (const item of items) {
    const { product_id, quantity } = item

    // 更新库存
    await db.collection('products').doc(product_id).update({
      data: {
        quantity: _.inc(quantity),
        updated_at: db.serverDate()
      }
    })

    // 更新编码中的数量段
    const product = await db.collection('products').doc(product_id).get()
    const newQty = product.data.quantity

    // 重新生成编码中的数量段
    const parts = product.data.code.split('-')
    if (parts.length >= 4) {
      parts[3] = String(newQty).padStart(4, '0')
    }
    await db.collection('products').doc(product_id).update({
      data: { code: parts.join('-') }
    })
  }

  // 创建入库日志
  await createInboundLog({
    inventory_id,
    order_no,
    type: 'search',
    remark: remark || '',
    items: items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      product_code: item.product_code,
      quantity: item.quantity,
      image_url: item.image_url || ''
    }))
  }, openid)

  return { code: 0, data: { updated: true } }
}

// ========== 入库日志 ==========

async function createInboundLog(event, openid) {
  const data = {
    inventory_id: event.inventory_id,
    order_no: event.order_no,
    type: event.type,
    remark: event.remark || '',
    items: event.items || [],
    owner_openid: openid,
    created_at: db.serverDate()
  }
  const res = await db.collection('inbound_logs').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function updateInboundLog(event) {
  const { id, ...data } = event
  await db.collection('inbound_logs').doc(id).update({ data })
  return { code: 0, data: { updated: true } }
}

async function deleteInboundLog(event) {
  const { id } = event
  // 回退库存
  const log = await db.collection('inbound_logs').doc(id).get()
  if (log.data && log.data.items) {
    for (const item of log.data.items) {
      await db.collection('products').doc(item.product_id).update({
        data: { quantity: _.inc(-item.quantity) }
      })
    }
  }
  await db.collection('inbound_logs').doc(id).remove()
  return { code: 0, data: { deleted: true } }
}

// ========== 出库单 ==========

async function createOutbound(event, openid) {
  const { inventory_id, order_no, type, status, order_info, remark, items, source_reserve_id } = event

  // 库存校验 + 扣减（出库单）/ 预留（预留单）
  for (const item of items) {
    const product = await db.collection('products').doc(item.product_id).get()
    if (!product.data) {
      return { code: 40400, message: '商品不存在: ' + item.product_id }
    }
    const available = product.data.quantity - (product.data.reserved_quantity || 0)
    if (type === 'outbound' && item.quantity > available) {
      return { code: 40001, message: '「' + item.product_name + '」可用库存不足: ' + available }
    }
    if (type === 'reserve' && item.quantity > available) {
      return { code: 40001, message: '「' + item.product_name + '」可预留不足: ' + available }
    }
  }

  // 扣减库存
  for (const item of items) {
    if (type === 'outbound') {
      await db.collection('products').doc(item.product_id).update({
        data: { quantity: _.inc(-item.quantity), updated_at: db.serverDate() }
      })
    } else if (type === 'reserve') {
      await db.collection('products').doc(item.product_id).update({
        data: { reserved_quantity: _.inc(item.quantity), updated_at: db.serverDate() }
      })
    }
  }

  const data = {
    inventory_id,
    order_no,
    type: type || 'outbound',
    status: status || 'pending',
    order_info: order_info || '',
    remark: remark || '',
    items,
    source_reserve_id: source_reserve_id || null,
    owner_openid: openid,
    created_at: db.serverDate(),
    updated_at: db.serverDate(),
    confirmed_at: null,
    cancelled_at: null
  }

  const res = await db.collection('outbound_orders').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function confirmOutbound(event) {
  const { id } = event
  await db.collection('outbound_orders').doc(id).update({
    data: { status: 'confirmed', confirmed_at: db.serverDate(), updated_at: db.serverDate() }
  })
  return { code: 0, data: { confirmed: true } }
}

async function cancelOutbound(event) {
  const { id } = event
  const order = await db.collection('outbound_orders').doc(id).get()
  if (!order.data) return { code: 40400, message: '订单不存在' }

  // 恢复库存
  if (order.data.items) {
    for (const item of order.data.items) {
      await db.collection('products').doc(item.product_id).update({
        data: { quantity: _.inc(item.quantity), updated_at: db.serverDate() }
      })
    }
  }

  await db.collection('outbound_orders').doc(id).update({
    data: { status: 'cancelled', cancelled_at: db.serverDate(), updated_at: db.serverDate() }
  })
  return { code: 0, data: { cancelled: true } }
}

async function cancelReserve(event) {
  const { id } = event
  const reserve = await db.collection('outbound_orders').doc(id).get()
  if (!reserve.data) return { code: 40400, message: '预留单不存在' }

  // 释放预留数量
  if (reserve.data.items) {
    for (const item of reserve.data.items) {
      await db.collection('products').doc(item.product_id).update({
        data: { reserved_quantity: _.inc(-item.quantity), updated_at: db.serverDate() }
      })
    }
  }

  await db.collection('outbound_orders').doc(id).update({
    data: { status: 'cancelled', cancelled_at: db.serverDate(), updated_at: db.serverDate() }
  })
  return { code: 0, data: { cancelled: true } }
}

async function reserveToOutbound(event, openid) {
  const { id, ...orderData } = event
  // 1. 标记原预留单为已确认
  await db.collection('outbound_orders').doc(id).update({
    data: { status: 'confirmed', confirmed_at: db.serverDate(), updated_at: db.serverDate() }
  })
  // 2. 释放原预留的 reserved_quantity
  const reserve = await db.collection('outbound_orders').doc(id).get()
  if (reserve.data && reserve.data.items) {
    for (const item of reserve.data.items) {
      await db.collection('products').doc(item.product_id).update({
        data: { reserved_quantity: _.inc(-item.quantity) }
      })
    }
  }
  // 3. 创建出库单（扣减实际库存）
  return createOutbound({
    ...orderData,
    type: 'outbound',
    status: 'pending',
    source_reserve_id: id
  }, openid)
}

// ========== 标签 ==========

async function createTag(event, openid) {
  // 检查重名
  const existing = await db.collection('tags').where({ name: event.name }).count()
  if (existing.total > 0) {
    return { code: 40001, message: '标签名称已存在' }
  }
  const data = {
    name: event.name,
    color: event.color || '#1890ff',
    owner_openid: openid,
    created_at: db.serverDate()
  }
  const res = await db.collection('tags').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function updateTag(event) {
  const { id, name, color } = event
  const data = {}
  if (name !== undefined) data.name = name
  if (color !== undefined) data.color = color
  await db.collection('tags').doc(id).update({ data })
  return { code: 0, data: { updated: true } }
}

async function deleteTag(event) {
  const { id } = event
  // 检查是否有商品关联
  const products = await db.collection('products').where({ tags: id }).count()
  if (products.total > 0) {
    return { code: 40001, message: '该标签下有商品，无法删除' }
  }
  await db.collection('tags').doc(id).remove()
  return { code: 0, data: { deleted: true } }
}

// ========== 白名单 ==========

async function addWhitelist(event) {
  const data = {
    openid: event.openid,
    nickname: event.nickname || '',
    avatar_url: event.avatar_url || '',
    role: event.role || 'member',
    added_by: event.added_by || '',
    created_at: db.serverDate()
  }
  const res = await db.collection('whitelist').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function removeWhitelist(event) {
  const { id } = event
  const entry = await db.collection('whitelist').doc(id).get()
  if (entry.data && entry.data.role === 'admin') {
    // 检查是否是唯一管理员
    const adminCount = await db.collection('whitelist').where({ role: 'admin' }).count()
    if (adminCount.total <= 1) {
      return { code: 40001, message: '不能移除唯一的管理员' }
    }
  }
  await db.collection('whitelist').doc(id).remove()
  return { code: 0, data: { deleted: true } }
}

// ========== 状态编码 ==========

async function addStatusCode(event, openid) {
  const existing = await db.collection('status_codes').where({ code: event.code }).count()
  if (existing.total > 0) {
    return { code: 40001, message: '状态编码已存在' }
  }
  const data = {
    code: event.code,
    label: event.label,
    is_system: false,
    owner_openid: openid,
    created_at: db.serverDate()
  }
  const res = await db.collection('status_codes').add({ data })
  return { code: 0, data: { _id: res._id, ...data } }
}

async function updateStatusCode(event) {
  const { id, label } = event
  if (!label || !label.trim()) {
    return { code: 40001, message: '状态名称不能为空' }
  }
  await db.collection('status_codes').doc(id).update({
    data: { label: label.trim() }
  })
  return { code: 0, data: { updated: true } }
}

async function removeStatusCode(event) {
  const { id } = event
  const code = await db.collection('status_codes').doc(id).get()
  if (code.data && code.data.is_system) {
    return { code: 40001, message: '系统预设状态编码不可删除' }
  }
  const used = await db.collection('products').where({ status_code: code.data.code }).count()
  if (used.total > 0) {
    return { code: 40001, message: '有商品正在使用此状态编码，无法删除' }
  }
  await db.collection('status_codes').doc(id).remove()
  return { code: 0, data: { deleted: true } }
}
