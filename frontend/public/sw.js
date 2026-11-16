// 빌드 때 vite.config.js 의 swPrecache 플러그인이 두 자리표시자를 채운다. 개발 중엔 SW 를 등록하지 않는다.
const BUILD_ID = '__BUILD_ID__'
const BUILD_ASSETS = ['__PRECACHE_LIST__']
const CACHE = `tj-shell-${BUILD_ID}`
const RUNTIME = 'tj-runtime-v1'
const SHELL = ['/', '/index.html', '/fonts/tj-sans-400.woff2', '/fonts/tj-sans-800.woff2']
const PRECACHE = [...SHELL, ...BUILD_ASSETS.filter((a) => a && !a.startsWith('__'))]

// 해시가 없지만 배포마다 바뀔 수 있는 파일. 네트워크 우선이다.
const NETWORK_FIRST_PATHS = new Set(['/manifest.json', '/favicon.svg', '/icons.svg', '/sw.js'])

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k)))
    await self.clients.claim()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) c.postMessage({ type: 'SW_UPDATED' })
  })())
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res.ok) cache.put(request, res.clone())
    return res
  } catch {
    return (await cache.match(request)) ?? Response.error()
  }
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request)
  if (hit) return hit
  const res = await fetch(request)
  const type = res.headers.get('Content-Type') || ''
  // 배포 뒤 사라진 청크 요청에 index.html 이 돌아오면 캐시하지 않는다(MIME 오류 고착 방지).
  if (res.ok && !type.includes('text/html')) {
    const cache = await caches.open(cacheName)
    cache.put(request, res.clone())
  }
  return res
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  if (e.request.method !== 'GET') return

  // API 는 화면 쪽(useApi)이 마지막 응답을 따로 보관한다. SW 는 손대지 않는다.
  if (url.pathname.startsWith('/api/')) return

  // 앱 셸은 캐시에서 바로 띄운다. 새 배포는 SW 교체(SW_UPDATED)로 반영된다.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html', { cacheName: CACHE }).then((hit) => hit ?? networkFirst(e.request, RUNTIME)),
    )
    return
  }

  if (NETWORK_FIRST_PATHS.has(url.pathname) || url.pathname.startsWith('/icons/')) {
    e.respondWith(networkFirst(e.request, RUNTIME))
    return
  }

  // 해시된 빌드 산출물, 글꼴, 날씨 사진은 내용이 바뀌면 이름이 바뀐다.
  e.respondWith(cacheFirst(e.request, url.pathname.startsWith('/assets/') ? CACHE : RUNTIME))
})

// ── F5: 노선 알림(막차/첫차 시각 푸시) ────────────────────────────────────
// 백엔드가 Web Push로 { title, body, url } 페이로드를 보낸다. 로그인이 없는
// 앱이라 알림에 사용자 식별 정보는 담기지 않는다.
self.addEventListener('push', (e) => {
  let data
  try {
    data = e.data ? e.data.json() : {}
  } catch {
    data = {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title ?? '탈:정왕', {
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
