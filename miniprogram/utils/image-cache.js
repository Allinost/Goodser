/**
 * Goodser 图片本地缓存模块
 *
 * 功能：
 * 1. 将远程图片下载到本地文件系统（wx.env.USER_DATA_PATH）
 * 2. 下次使用时直接返回本地路径，避免重复下载
 * 3. 清理：全部清理 / 清理未使用图片
 *
 * 注意：
 * - 微信小程序本地文件系统上限 200MB
 * - 图片以 URL hash 命名，避免冲突
 */

var IMAGE_DIR = 'gs_img/'
var META_KEY = 'gs_image_meta'    // Storage key: { [urlHash]: { url, ts, size, refs } }

// ========== 内部工具 ==========

function _hash(str) {
  var hash = 0
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + c
    hash |= 0  // Convert to 32bit integer
  }
  return 'img_' + Math.abs(hash).toString(36)
}

function _getFSPath(hash) {
  return wx.env.USER_DATA_PATH + '/' + IMAGE_DIR + hash
}

function _loadMeta() {
  try {
    return wx.getStorageSync(META_KEY) || {}
  } catch (e) {
    return {}
  }
}

function _saveMeta(meta) {
  try {
    wx.setStorageSync(META_KEY, meta)
  } catch (e) {}
}

function _ensureDir() {
  try {
    var fs = wx.getFileSystemManager()
    var dir = wx.env.USER_DATA_PATH + '/' + IMAGE_DIR
    try { fs.accessSync(dir) } catch (e) { fs.mkdirSync(dir, true) }
  } catch (e) {}
}

// ========== 公开 API ==========

/**
 * 缓存单张图片
 * @param {string} remoteUrl  远程图片地址
 * @param {string} refKey     引用标识（如产品 _id），用于标记"使用中"
 * @returns {Promise<string>} 本地文件路径（失败时返回原 URL）
 */
function cacheImage(remoteUrl, refKey) {
  return new Promise(function(resolve) {
    if (!remoteUrl) { resolve(''); return }

    // 本地路径或占位图不处理
    if (remoteUrl.indexOf('wxfile://') === 0 ||
        remoteUrl.indexOf(wx.env.USER_DATA_PATH) === 0 ||
        remoteUrl.indexOf('/images/') === 0) {
      resolve(remoteUrl)
      return
    }

    var hash = _hash(remoteUrl)
    var localPath = _getFSPath(hash)

    // 检查本地是否已存在
    var fs = wx.getFileSystemManager()
    try {
      fs.accessSync(localPath)
      // 文件已存在，标记引用
      _markRef(hash, refKey)
      resolve(localPath)
      return
    } catch (e) {}

    // 不存在，下载到本地
    _ensureDir()

    wx.downloadFile({
      url: remoteUrl,
      success: function(res) {
        if (res.statusCode === 200) {
          // 移动到管理目录
          try {
            fs.saveFileSync(res.tempFilePath, localPath)
            _trackImage(hash, remoteUrl, refKey)
            console.log('[ImageCache] 已缓存:', hash, '←', remoteUrl.substring(0, 60))
            resolve(localPath)
          } catch (e) {
            console.warn('[ImageCache] 保存失败:', e)
            resolve(remoteUrl)  // 降级：返回远程 URL
          }
        } else {
          resolve(remoteUrl)
        }
      },
      fail: function(err) {
        console.warn('[ImageCache] 下载失败:', err.errMsg)
        resolve(remoteUrl)  // 降级
      }
    })
  })
}

/**
 * 批量缓存图片（建议在页面 onLoad/onShow 中调用）
 * @param {Array<{url: string, refKey: string}>} items
 * @returns {Promise<Array<string>>} 本地路径数组
 */
async function cacheImages(items) {
  if (!items || items.length === 0) return []
  var results = []
  for (var i = 0; i < items.length; i++) {
    results.push(await cacheImage(items[i].url, items[i].refKey))
  }
  return results
}

/**
 * 获取缓存统计
 * @returns {{ count: number, totalKB: number }}
 */
function getImageStats() {
  var meta = _loadMeta()
  var keys = Object.keys(meta)
  var totalSize = 0
  keys.forEach(function(k) { totalSize += meta[k].size || 0 })
  return {
    count: keys.length,
    totalKB: Math.round(totalSize / 102.4) / 10
  }
}

/**
 * 清理所有图片缓存
 * @returns {{ removed: number }}
 */
function clearAllImages() {
  var meta = _loadMeta()
  var keys = Object.keys(meta)

  try {
    var fs = wx.getFileSystemManager()
    var dir = wx.env.USER_DATA_PATH + '/' + IMAGE_DIR

    // 尝试删除整个目录
    try {
      fs.rmdirSync(dir, true)
    } catch (e) {
      // 逐个删除
      keys.forEach(function(hash) {
        try { fs.unlinkSync(_getFSPath(hash)) } catch (e2) {}
      })
    }

    wx.removeStorageSync(META_KEY)
    console.log('[ImageCache] 已清理全部 ' + keys.length + ' 张图片')
    return { removed: keys.length }
  } catch (e) {
    console.warn('[ImageCache] 清理失败:', e)
    return { removed: 0 }
  }
}

/**
 * 清理未使用的图片（未被任何商品引用的）
 * @param {Array<string>} usedUrls  当前正在使用中的所有 remoteUrl
 * @returns {{ removed: number, kept: number }}
 */
function clearUnusedImages(usedUrls) {
  usedUrls = usedUrls || []
  var usedHashes = {}
  usedUrls.forEach(function(url) {
    if (url) usedHashes[_hash(url)] = true
  })

  var meta = _loadMeta()
  var allHashes = Object.keys(meta)
  var removed = 0
  var kept = 0

  try {
    var fs = wx.getFileSystemManager()
    allHashes.forEach(function(hash) {
      if (usedHashes[hash]) {
        kept++
      } else {
        try { fs.unlinkSync(_getFSPath(hash)) } catch (e) {}
        delete meta[hash]
        removed++
      }
    })

    _saveMeta(meta)
    console.log('[ImageCache] 清理完成：移除 ' + removed + ' 张，保留 ' + kept + ' 张')
    return { removed: removed, kept: kept }
  } catch (e) {
    console.warn('[ImageCache] 清理未使用图片失败:', e)
    return { removed: 0, kept: allHashes.length }
  }
}

/**
 * 获取图片本地路径（已有缓存时直接返回，不下载）
 * @param {string} remoteUrl
 * @returns {string} 本地路径或原 URL
 */
function getLocalPath(remoteUrl) {
  if (!remoteUrl) return ''
  if (remoteUrl.indexOf('wxfile://') === 0 ||
      remoteUrl.indexOf(wx.env.USER_DATA_PATH) === 0 ||
      remoteUrl.indexOf('/images/') === 0) {
    return remoteUrl
  }

  var hash = _hash(remoteUrl)
  var localPath = _getFSPath(hash)

  try {
    wx.getFileSystemManager().accessSync(localPath)
    return localPath
  } catch (e) {
    return remoteUrl
  }
}

// ========== 内部辅助 ==========

function _markRef(hash, refKey) {
  if (!refKey) return
  var meta = _loadMeta()
  if (meta[hash]) {
    meta[hash].refs = meta[hash].refs || {}
    meta[hash].refs[refKey] = true
    _saveMeta(meta)
  }
}

function _trackImage(hash, url, refKey) {
  var meta = _loadMeta()
  var size = 0
  try {
    var stat = wx.getFileSystemManager().statSync(_getFSPath(hash))
    size = stat.size
  } catch (e) {}
  meta[hash] = {
    url: url,
    ts: Date.now(),
    size: size,
    refs: refKey ? (_a(refKey)) : {}
  }
  _saveMeta(meta)
}

function _a(key) { var o = {}; o[key] = true; return o }

module.exports = {
  cacheImage: cacheImage,
  cacheImages: cacheImages,
  getLocalPath: getLocalPath,
  getImageStats: getImageStats,
  clearAllImages: clearAllImages,
  clearUnusedImages: clearUnusedImages
}
