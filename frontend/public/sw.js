const CACHE = 'transit-hub-v1'
const PRECACHE = ['/', '/index.html']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // API 요청: 네트워크 우선, 실패 시 캐시 fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    )
    return
  }

  // 정적 에셋: 캐시 우선
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res
        const clone = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, clone))
        return res
      })
    })
  )
})
