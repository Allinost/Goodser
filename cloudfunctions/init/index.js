/**
 * Goodser 初始化云函数
 * 首次使用时调用，创建预设数据和首个管理员
 *
 * 调用方式：
 *   wx.cloud.callFunction({ name: 'init', data: { action: 'setup' } })
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 预设状态编码
const PRESET_STATUS_CODES = [
  { code: 'A', label: '自留', is_system: true },
  { code: 'B', label: '预留', is_system: true },
  { code: 'C', label: '已拆', is_system: true },
  { code: 'D', label: '损坏', is_system: true },
  { code: 'E', label: '过期', is_system: true },
  { code: 'F', label: '停用', is_system: true },
  { code: 'N', label: '全新', is_system: true }
]

// 预设标签颜色
const PRESET_TAGS = [
  { name: '热销', color: '#ff4d4f' },
  { name: '新品', color: '#1890ff' },
  { name: '清仓', color: '#faad14' },
  { name: '预售', color: '#722ed1' },
  { name: '电子数码', color: '#13c2c2' },
  { name: '配件', color: '#52c41a' }
]

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  if (!OPENID) {
    return { code: 40100, message: '无法获取用户身份' }
  }

  if (action === 'setup') {
    return setup(OPENID)
  }

  if (action === 'check') {
    return checkInit()
  }

  return { code: 40000, message: '未知操作: ' + action }
}

/**
 * 检查是否已初始化
 */
async function checkInit() {
  const codes = await db.collection('status_codes').count()
  return {
    code: 0,
    data: {
      initialized: codes.total > 0,
      statusCodeCount: codes.total
    }
  }
}

/**
 * 执行初始化
 */
async function setup(openid) {
  // 检查是否已初始化
  const existing = await db.collection('status_codes').count()
  if (existing.total > 0) {
    return { code: 40001, message: '系统已初始化，无需重复操作' }
  }

  const results = {}

  // 1. 创建预设状态编码
  for (const sc of PRESET_STATUS_CODES) {
    await db.collection('status_codes').add({
      data: {
        ...sc,
        owner_openid: openid,
        created_at: db.serverDate()
      }
    })
  }
  results.statusCodes = PRESET_STATUS_CODES.length

  // 2. 创建预设标签
  for (const tag of PRESET_TAGS) {
    await db.collection('tags').add({
      data: {
        ...tag,
        owner_openid: openid,
        created_at: db.serverDate()
      }
    })
  }
  results.tags = PRESET_TAGS.length

  // 3. 创建默认仓库
  await db.collection('inventories').add({
    data: {
      name: '默认仓库',
      owner_openid: openid,
      sort_order: 0,
      created_at: db.serverDate(),
      updated_at: db.serverDate()
    }
  })
  results.inventories = 1

  // 4. 将当前用户加入白名单（管理员）
  const existingUser = await db.collection('whitelist').where({ openid }).count()
  if (existingUser.total === 0) {
    await db.collection('whitelist').add({
      data: {
        openid,
        nickname: '管理员',
        avatar_url: '',
        role: 'admin',
        added_by: null,
        created_at: db.serverDate()
      }
    })
    results.whitelist = 1
  } else {
    results.whitelist = 0
  }

  return {
    code: 0,
    data: {
      message: '初始化完成',
      ...results
    }
  }
}
