// 展示页离线缓存 Service Worker
// 策略：页面 / 数据「网络优先、失败用缓存」，静态资源「缓存优先、后台更新」。
// 服务器断电/断网时，电视仍能完整显示最后一次成功加载的内容，客人无感知。
const CACHE = 'innboard-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // 首次安装就把展示页 HTML 预缓存，保证断电/断网重开页面也能加载
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(['/display', '/'].map((u) => cache.add(u).catch(() => {}))))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// 从缓存读取 /api/display，并把 server_time 改成当前时间，
// 避免离线时用旧的 server_time 把电视时钟带偏。
async function cachedDisplay(cache, req) {
  const cached = await cache.match(req)
  if (!cached) return null
  try {
    const data = await cached.clone().json()
    if (data && data.server_time) {
      data.server_time = new Date().toISOString()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  } catch (e) {
    /* 解析失败则原样返回缓存 */
  }
  return cached
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // 页面导航（HTML）：网络优先，失败回退缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }
          return caches.match(req)
        })
        .catch(() => caches.match(req))
    )
    return
  }

  // 展示数据接口：网络优先，失败/出错回退缓存
  if (url.pathname === '/api/display') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(req)
          if (res.ok) {
            cache.put(req, res.clone())
            return res
          }
          return (await cachedDisplay(cache, req)) || res
        } catch (e) {
          return (await cachedDisplay(cache, req)) || Response.error()
        }
      })
    )
    return
  }

  // 静态资源与图片：缓存优先，后台更新
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) {
              caches.open(CACHE).then((c) => c.put(req, res.clone()))
              return res
            }
            return res
          })
          .catch(() => cached)
        return cached || network
      })
    )
  }
})
