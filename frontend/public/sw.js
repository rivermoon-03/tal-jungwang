const CACHE = 'transit-hub-v7'
const PRECACHE = ['/', '/index.html']

// 해시되지 않은 루트 정적 파일 — 배포할 때마다 내용이 바뀔 수 있으므로
// 캐시 우선이면 옛 매니페스트/아이콘이 고착됨. 네트워크 우선으로 처리한다.
const NETWORK_FIRST_PATHS = new Set([
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg',
  '/sw.js',
])

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) c.postMessage({ type: 'SW_UPDATED' })
  })())
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // 타 출처(카카오맵 SDK, Pretendard CDN 등)는 SW에서 건드리지 않음
  if (url.origin !== self.location.origin) return

  // GET 이외 메서드(POST 등 API 호출)는 그대로 통과
  if (e.request.method !== 'GET') return

  // /api/v1/map/markers — NetworkFirst(+offline fallback).
  // 과거 StaleWhileRevalidate였지만 마커 변경 시 stale 응답이 오래 고착됨(노선 추가 반영 지연).
  // 네트워크 우선으로 바꾸되 오프라인일 때만 캐시로 폴백한다.
  if (url.pathname === '/api/v1/map/markers') {
    e.respondWith(
      caches.open(CACHE).then(async (cache) => {
        try {
          const res = await fetch(e.request)
          if (res.status === 200) cache.put(e.request, res.clone())
          return res
        } catch {
          const cached = await cache.match(e.request)
          return cached ?? new Response(JSON.stringify({ success: false }), {
            status: 503, headers: { 'Content-Type': 'application/json' },
          })
        }
      })
    )
    return
  }

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

  // manifest/favicon/icons 등 해시 없는 정적 파일 — 네트워크 우선
  // (배포마다 내용이 바뀔 수 있어 캐시-우선이면 옛 버전이 고착됨)
  const isUnhashedStatic =
    NETWORK_FIRST_PATHS.has(url.pathname) || url.pathname.startsWith('/icons/')
  if (isUnhashedStatic) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request))
    )
    return
  }

  // 해시된 정적 에셋(/assets/*) — 캐시 우선, 없으면 네트워크 후 캐시 저장.
  // 배포 후 사라진 청크는 rewrite가 index.html(HTML)을 돌려줄 수 있으므로,
  // 실패 응답이거나 Content-Type이 text/html이면 캐싱하지 않고 그대로 반환한다
  // (HTML을 JS로 캐싱해 고착시키면 "disallowed MIME type" 에러가 반복됨).
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached

      return fetch(e.request).then((res) => {
        const contentType = res.headers.get('Content-Type') || ''
        if (res.ok && !contentType.includes('text/html')) {
          const clone = res.clone()
          caches.open(CACHE).then((c) => c.put(e.request, clone))
        }
        return res
      })
    })
  )
})

// ── F5: 노선 알림(막차/첫차 시각 푸시) ────────────────────────────────────
// 백엔드가 Web Push로 { title, body, url } 페이로드를 보낸다. 로그인이 없는
// 앱이라 알림에 사용자 식별 정보는 담기지 않는다.
self.addEventListener('push', (e) => {
  let data = {}
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title ?? '탈것:정왕', {
      body: data.body ?? '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = e.notification.data?.url ?? '/'
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsList) => {
      const existing = clientsList.find((c) => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        if ('navigate' in existing) existing.navigate(url)
        return undefined
      }
      return self.clients.openWindow(url)
    })
  )
})
