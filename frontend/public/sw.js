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

  // 타 출처(카카오맵 SDK, Pretendard CDN 등)는 SW에서 건드리지 않음
  if (url.origin !== self.location.origin) return

  // GET 이외 메서드(POST 등 API 호출)는 그대로 통과
  if (e.request.method !== 'GET') return

  // /api/* — 네트워크 우선, 실패 시 503
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ success: false }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }))
    )
    return
  }

  // HTML 네비게이션 — 네트워크 우선, 실패 시 캐시 폴백
  // (Vite 배포마다 해시가 바뀌므로 항상 최신 index.html을 받아야 함)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // 정적 에셋 — 캐시 우선, 없으면 네트워크 후 캐시 저장
  // (해시된 파일명은 불변이므로 캐시 우선 안전)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached

      return fetch(e.request).then((res) => {
        if (res.status === 200) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
    })
  )
})
