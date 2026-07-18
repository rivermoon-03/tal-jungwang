/**
 * pushNotifications — F5 노선 알림(막차/첫차 시각 푸시)의 구독 유틸.
 *
 * 이 앱은 로그인이 없다. `PushManager.subscribe()`가 반환하는 `endpoint`가
 * 기기별 고유 식별자 역할을 하며, 백엔드는 (endpoint → favorite_codes) 매핑만
 * 저장한다. favoriteCodes는 useAppStore의 `favorites.routes` 배열 그대로이고
 * 각 항목은 "등교:5602" / "shuttle:등교" / "subway:정왕:..." 같은 favCode 포맷이다.
 *
 * API 계약(백엔드):
 *   GET    /push/vapid-public-key            → { public_key }
 *   POST   /push/subscribe                   body { endpoint, keys, favorite_codes }
 *   PUT    /push/subscriptions/favorites      body { endpoint, favorite_codes }
 *   DELETE /push/subscribe                   body { endpoint }
 *
 * 네트워크 호출은 프로젝트 공용 apiFetch(useApi.js)를 그대로 재사용한다
 * (in-flight dedup/캐시는 GET에만 적용되고 이 파일의 POST/PUT/DELETE는
 * 해당 없음 — apiFetch는 그 경우 그냥 fetch 래퍼로 동작한다).
 */
import { apiFetch } from '../hooks/useApi'

// ── 지원 여부 ──────────────────────────────────────────────────────────
export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window
  )
}

// ── base64url(VAPID 공개키) → Uint8Array ────────────────────────────────
// PushManager.subscribe의 applicationServerKey는 Uint8Array(또는 ArrayBuffer)만
// 받는다. 서버는 base64url(RFC4648 §5, '+'/'/' 대신 '-'/'_', 패딩 없음)로 준다.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function fetchVapidPublicKey() {
  const data = await apiFetch('/push/vapid-public-key')
  return data?.public_key ?? null
}

// 이미 등록된 SW가 있는지만 확인(등록이 없으면 즉시 null — .ready처럼
// 무한 대기하지 않는다). 개발 모드는 SW를 등록하지 않으므로(main.jsx),
// 설정 화면 mount 시 상태 조회가 여기서 멈추면 안 된다.
async function getExistingRegistration() {
  if (!isPushSupported()) return null
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return reg ?? null
  } catch {
    return null
  }
}

async function getExistingSubscription() {
  const reg = await getExistingRegistration()
  if (!reg) return null
  try {
    return await reg.pushManager.getSubscription()
  } catch {
    return null
  }
}

// 현재 알림 권한 상태. Notification API 자체가 없는 브라우저는 'unsupported'.
export function getNotificationPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

// 설정 화면 mount 시 초기 스위치 상태 판정에 쓴다. SW .ready를 기다리지 않아
// SW 미등록 환경(dev)에서도 즉시 resolve된다.
export async function hasActivePushSubscription() {
  if (!isPushSupported()) return false
  const sub = await getExistingSubscription()
  return sub != null
}

/**
 * 알림 구독 시작. 권한 요청 → SW ready → pushManager.subscribe → 백엔드 등록.
 * 반환값: { ok: true } | { ok: false, reason: 'unsupported' | 'denied' | 'dismissed' | 'no-vapid-key' }
 * reason이 'denied'면 브라우저가 재요청을 막으므로(Notification.requestPermission이
 * 즉시 'denied'로 resolve) UI가 "브라우저 설정에서 알림을 허용해주세요" 안내를 띄워야 한다.
 */
export async function subscribeToPush(favoriteCodes = []) {
  if (!isPushSupported() || typeof Notification === 'undefined') {
    return { ok: false, reason: 'unsupported' }
  }
  if (Notification.permission === 'denied') {
    return { ok: false, reason: 'denied' }
  }

  const permission =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' }
  }

  const publicKey = await fetchVapidPublicKey()
  if (!publicKey) return { ok: false, reason: 'no-vapid-key' }

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })

  const json = subscription.toJSON()
  await apiFetch('/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      favorite_codes: favoriteCodes,
    }),
  })

  return { ok: true }
}

/** 구독 해제. 기존 구독이 없으면 아무 것도 안 하고 성공 처리한다. */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const subscription = await getExistingSubscription()
  if (!subscription) return { ok: true }

  const endpoint = subscription.endpoint
  await subscription.unsubscribe()
  await apiFetch('/push/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  })

  return { ok: true }
}

/**
 * 이미 구독 중이면 즐겨찾기 목록을 백엔드에 최신화한다(PUT). 구독 중이 아니면
 * 아무 것도 하지 않는다 — v1 스코프: favorites 변경을 실시간 감시하지 않고,
 * 설정 화면을 다시 열거나 스위치를 껐다 켤 때만 동기화한다.
 */
export async function syncPushFavorites(favoriteCodes = []) {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  const subscription = await getExistingSubscription()
  if (!subscription) return { ok: false, reason: 'not-subscribed' }

  await apiFetch('/push/subscriptions/favorites', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint, favorite_codes: favoriteCodes }),
  })

  return { ok: true }
}
