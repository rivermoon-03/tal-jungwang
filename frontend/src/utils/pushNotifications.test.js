import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch } from '../hooks/useApi'
import {
  isPushSupported,
  urlBase64ToUint8Array,
  getNotificationPermission,
  requestNotificationPermission,
  hasActivePushSubscription,
  subscribeToPush,
  unsubscribeFromPush,
  syncPushFavorites,
} from './pushNotifications'

vi.mock('../hooks/useApi', () => ({
  apiFetch: vi.fn(),
}))

// ── 테스트용 브라우저 API 목(mock) 헬퍼 ───────────────────────────────────
// jsdom엔 PushManager/Notification/serviceWorker가 없으므로 각 테스트마다
// 필요한 만큼만 전역에 심고, afterEach에서 원복한다.
function stubServiceWorker({ registration = null, readyRegistration = registration } = {}) {
  Object.defineProperty(window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
    writable: true,
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn().mockResolvedValue(registration),
      ready: Promise.resolve(readyRegistration),
    },
    configurable: true,
    writable: true,
  })
}

function stubNotification(permission, requestPermissionResult) {
  const NotificationMock = {
    permission,
    requestPermission: vi.fn().mockResolvedValue(requestPermissionResult ?? permission),
  }
  Object.defineProperty(globalThis, 'Notification', {
    value: NotificationMock,
    configurable: true,
    writable: true,
  })
  return NotificationMock
}

function makeSubscription(endpoint = 'https://push.example/abc') {
  return {
    endpoint,
    toJSON: () => ({ keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  delete window.PushManager
  delete navigator.serviceWorker
  delete globalThis.Notification
})

describe('urlBase64ToUint8Array', () => {
  it('패딩 없는 base64url을 올바른 바이트로 변환한다', () => {
    // "hello" 의 base64는 "aGVsbG8=" → base64url로는 "aGVsbG8"(패딩 제거)
    const result = urlBase64ToUint8Array('aGVsbG8')
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]) // 'h','e','l','l','o'
  })

  it("'-'/'_' 를 표준 base64 '+'/'/' 로 되돌려 디코딩한다", () => {
    // 표준 base64 "+/8=" ↔ base64url "-_8"
    const result = urlBase64ToUint8Array('-_8')
    expect(Array.from(result)).toEqual([0xfb, 0xff])
  })
})

describe('isPushSupported / getNotificationPermission', () => {
  it('serviceWorker·PushManager가 모두 있어야 지원으로 판정한다', () => {
    stubServiceWorker()
    expect(isPushSupported()).toBe(true)
  })

  it('PushManager가 없으면 미지원', () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: {}, configurable: true })
    expect(isPushSupported()).toBe(false)
  })

  it('Notification 전역이 없으면 unsupported', () => {
    expect(getNotificationPermission()).toBe('unsupported')
  })

  it('Notification.permission을 그대로 반환한다', () => {
    stubNotification('granted')
    expect(getNotificationPermission()).toBe('granted')
  })
})

describe('requestNotificationPermission', () => {
  it('Notification 전역이 없으면 unsupported', async () => {
    await expect(requestNotificationPermission()).resolves.toBe('unsupported')
  })

  it('이미 granted면 재요청 없이 즉시 granted', async () => {
    const notif = stubNotification('granted')
    await expect(requestNotificationPermission()).resolves.toBe('granted')
    expect(notif.requestPermission).not.toHaveBeenCalled()
  })

  it('이미 denied면 재요청 없이 즉시 denied', async () => {
    const notif = stubNotification('denied')
    await expect(requestNotificationPermission()).resolves.toBe('denied')
    expect(notif.requestPermission).not.toHaveBeenCalled()
  })

  it('default면 요청하고 결과를 그대로 반영한다(granted)', async () => {
    const notif = stubNotification('default', 'granted')
    await expect(requestNotificationPermission()).resolves.toBe('granted')
    expect(notif.requestPermission).toHaveBeenCalled()
  })

  it('default에서 dismissed(default로 남음)면 dismissed로 정규화한다', async () => {
    stubNotification('default', 'default')
    await expect(requestNotificationPermission()).resolves.toBe('dismissed')
  })
})

describe('hasActivePushSubscription', () => {
  it('미지원 환경이면 false', async () => {
    await expect(hasActivePushSubscription()).resolves.toBe(false)
  })

  it('등록은 있으나 구독이 없으면 false (getRegistration 사용, .ready로 블로킹하지 않음)', async () => {
    const sub = null
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(sub) } },
    })
    await expect(hasActivePushSubscription()).resolves.toBe(false)
  })

  it('활성 구독이 있으면 true', async () => {
    const subscription = makeSubscription()
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } },
    })
    await expect(hasActivePushSubscription()).resolves.toBe(true)
  })
})

describe('subscribeToPush', () => {
  it('미지원 환경이면 unsupported', async () => {
    const result = await subscribeToPush(['등교:5602'])
    expect(result).toEqual({ ok: false, reason: 'unsupported' })
  })

  it('권한이 이미 denied면 재요청 없이 즉시 denied 반환', async () => {
    stubServiceWorker()
    const notif = stubNotification('denied')
    const result = await subscribeToPush(['등교:5602'])
    expect(result).toEqual({ ok: false, reason: 'denied' })
    expect(notif.requestPermission).not.toHaveBeenCalled()
  })

  it('권한 요청이 거부/무시되면 해당 사유를 반환한다', async () => {
    stubServiceWorker()
    stubNotification('default', 'dismissed')
    const result = await subscribeToPush(['등교:5602'])
    expect(result).toEqual({ ok: false, reason: 'dismissed' })
  })

  it('허용되면 vapid 공개키 조회 → subscribe → 백엔드 등록까지 이어진다', async () => {
    const subscription = makeSubscription('https://push.example/xyz')
    stubServiceWorker({
      readyRegistration: {
        pushManager: { subscribe: vi.fn().mockResolvedValue(subscription) },
      },
    })
    stubNotification('default', 'granted')
    apiFetch.mockImplementation((path) => {
      if (path === '/push/vapid-public-key') return Promise.resolve({ public_key: 'aGVsbG8' })
      return Promise.resolve(null)
    })

    const result = await subscribeToPush(['등교:5602', 'shuttle:등교'])

    expect(result).toEqual({ ok: true })
    expect(apiFetch).toHaveBeenCalledWith('/push/vapid-public-key')
    const subscribeCall = apiFetch.mock.calls.find(([path]) => path === '/push/subscribe')
    expect(subscribeCall).toBeTruthy()
    const [, options] = subscribeCall
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      endpoint: 'https://push.example/xyz',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      favorite_codes: ['등교:5602', 'shuttle:등교'],
    })
  })
})

describe('unsubscribeFromPush', () => {
  it('구독이 없으면 그냥 성공 처리하고 DELETE를 호출하지 않는다', async () => {
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } },
    })
    const result = await unsubscribeFromPush()
    expect(result).toEqual({ ok: true })
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('구독이 있으면 unsubscribe() 후 백엔드에도 DELETE 요청한다', async () => {
    const subscription = makeSubscription('https://push.example/xyz')
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } },
    })
    apiFetch.mockResolvedValue(null)

    const result = await unsubscribeFromPush()

    expect(result).toEqual({ ok: true })
    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(apiFetch).toHaveBeenCalledWith('/push/subscribe', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example/xyz' }),
    }))
  })
})

describe('syncPushFavorites', () => {
  it('구독 중이 아니면 아무 것도 호출하지 않는다', async () => {
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } },
    })
    const result = await syncPushFavorites(['등교:5602'])
    expect(result).toEqual({ ok: false, reason: 'not-subscribed' })
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it('구독 중이면 PUT으로 즐겨찾기 목록을 최신화한다', async () => {
    const subscription = makeSubscription('https://push.example/xyz')
    stubServiceWorker({
      registration: { pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } },
    })
    apiFetch.mockResolvedValue(null)

    const result = await syncPushFavorites(['등교:5602', '하교:5602'])

    expect(result).toEqual({ ok: true })
    expect(apiFetch).toHaveBeenCalledWith('/push/subscriptions/favorites', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        endpoint: 'https://push.example/xyz',
        favorite_codes: ['등교:5602', '하교:5602'],
      }),
    }))
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})
