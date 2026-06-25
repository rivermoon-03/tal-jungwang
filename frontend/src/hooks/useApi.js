import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/v1'

// 같은 path에 대한 동시 요청은 하나로 합치고(in-flight dedup),
// ttl 동안은 캐시된 응답을 즉시 돌려준다.
// 여러 컴포넌트가 같은 useApi(path)를 쓰면 네트워크 요청은 1회만 발생.
//
// 캐시는 LRU(최대 CACHE_MAX 엔트리)다. 파라미터화 path(/recommend/transport?…,
// /bus/arrivals/{id}, 날짜별 timetable)가 영구 누적되지 않도록 set 시 초과분을
// 가장 오래 안 쓴 엔트리부터 제거한다. Map은 삽입 순서를 보존하므로 get 시
// 재삽입(delete→set)으로 "최근 사용"을 갱신한다.
const CACHE_MAX = 100
const cacheStore = new Map()  // path -> { data, fetchedAt }
const inflight = new Map()    // path -> Promise<data>

// LRU 일관성을 위해 get/set/has/delete/clear를 한 곳으로 일원화한다.
const cache = {
  get(path) {
    const c = cacheStore.get(path)
    if (c === undefined) return undefined
    // 최근 사용으로 끌어올림(재삽입 → Map 삽입 순서상 가장 최신).
    cacheStore.delete(path)
    cacheStore.set(path, c)
    return c
  },
  set(path, value) {
    // 이미 있으면 먼저 지워 순서를 갱신.
    if (cacheStore.has(path)) cacheStore.delete(path)
    cacheStore.set(path, value)
    // 초과분(가장 오래된 것 = Map의 첫 키)부터 제거.
    while (cacheStore.size > CACHE_MAX) {
      const oldest = cacheStore.keys().next().value
      cacheStore.delete(oldest)
    }
  },
  delete(path) {
    return cacheStore.delete(path)
  },
  clear() {
    cacheStore.clear()
  },
}

export async function apiFetch(path, options) {
  // API 응답은 브라우저 HTTP 캐시(heuristic freshness)를 타면 안 된다.
  // 백엔드는 Redis로 캐시하고 클라이언트는 매 마운트마다 최신을 받아야 함.
  const res = await fetch(`${BASE}${path}`, { cache: 'no-store', ...options })
  if (!res.ok) {
    const httpErr = new Error(`API ${res.status}`)
    httpErr.status = res.status
    throw httpErr
  }
  const json = await res.json()
  if (!json.success) {
    const apiErr = new Error(json.error?.message ?? 'API error')
    apiErr.code = json.error?.code ?? null
    throw apiErr
  }
  return json.data
}

function fetchDedup(path) {
  const existing = inflight.get(path)
  if (existing) return existing
  const p = apiFetch(path)
    .then((data) => {
      cache.set(path, { data, fetchedAt: Date.now() })
      return data
    })
    .finally(() => {
      inflight.delete(path)
    })
  inflight.set(path, p)
  return p
}

function readFreshCache(path, ttl) {
  if (!ttl) return null
  const c = cache.get(path)
  if (!c) return null
  if (Date.now() - c.fetchedAt >= ttl) return null
  return c
}

export function invalidateApiCache(path) {
  if (path) cache.delete(path)
  else cache.clear()
}

// ── path 단위 단일 스케줄러 ─────────────────────────────────────────
// 같은 (path, interval)을 N개 컴포넌트가 폴링하면 타이머가 N개로 늘고,
// in-flight dedup 위상이 어긋나면 같은 path가 중복 폴링된다.
// 그래서 (path, interval)별로 타이머 1개 + 구독자 set을 둔다.
// - 첫 구독자가 타이머/visibility 리스너 생성, 마지막 구독자 해제 시 정리.
// - 틱마다 fetchDedup(path) 1회 → 모든 구독자에게 broadcast.
// - document.hidden이면 폴링 중단(인스턴스마다가 아니라 path당 1회 처리).
const schedulers = new Map()  // `${interval}|${path}` -> scheduler

function schedulerKey(path, interval) {
  return `${interval}|${path}`
}

function getScheduler(path, interval) {
  const key = schedulerKey(path, interval)
  let s = schedulers.get(key)
  if (s) return s

  s = {
    key,
    path,
    interval,
    subscribers: new Set(),  // (onResult, onError) 핸들러 묶음
    timerId: null,
    onVisibility: null,
  }

  const tick = () => {
    fetchDedup(path)
      .then((result) => {
        const fetchedAt = Date.now()
        // 틱 중 구독 해제가 일어날 수 있어 스냅샷 순회.
        for (const sub of Array.from(s.subscribers)) sub.onResult(result, fetchedAt)
      })
      .catch((err) => {
        for (const sub of Array.from(s.subscribers)) sub.onError(err)
      })
  }

  const startTimer = () => {
    if (s.timerId == null) s.timerId = setInterval(tick, interval)
  }
  const stopTimer = () => {
    if (s.timerId != null) {
      clearInterval(s.timerId)
      s.timerId = null
    }
  }

  s.onVisibility = () => {
    if (document.hidden) {
      stopTimer()
    } else {
      tick()
      startTimer()
    }
  }

  s.start = () => {
    document.addEventListener('visibilitychange', s.onVisibility)
    if (!document.hidden) startTimer()
  }
  s.stop = () => {
    stopTimer()
    document.removeEventListener('visibilitychange', s.onVisibility)
  }
  s.tick = tick

  schedulers.set(key, s)
  return s
}

function subscribeScheduler(path, interval, onResult, onError) {
  const s = getScheduler(path, interval)
  const sub = { onResult, onError }
  const first = s.subscribers.size === 0
  s.subscribers.add(sub)
  if (first) s.start()

  return () => {
    s.subscribers.delete(sub)
    if (s.subscribers.size === 0) {
      s.stop()
      schedulers.delete(s.key)
    }
  }
}

export function useApi(path, { interval = null, enabled = true, ttl = 0 } = {}) {
  const initial = enabled ? readFreshCache(path, ttl) : null
  const [data, setData] = useState(initial?.data ?? null)
  const [loading, setLoading] = useState(enabled && !initial)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(initial?.fetchedAt ?? null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    try {
      const result = await fetchDedup(path)
      setData(result)
      setFetchedAt(Date.now())
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [path, enabled])

  // path가 바뀌면 직전 응답은 다른 리소스의 stale 데이터이므로
  // in-flight 동안 loading=true, data=null로 재설정한다.
  // (그렇지 않으면 소비자가 stale data + loading=false를 보고
  //  "데이터 없음" 분기로 오판 — 예: 시흥1 = 실시간 전용인데 시간표 폴백으로 빠짐)
  // 단, 캐시 히트가 있으면 그 값으로 즉시 채운다.
  useEffect(() => {
    if (!enabled) return
    const c = readFreshCache(path, ttl)
    if (c) {
      setData(c.data)
      setFetchedAt(c.fetchedAt)
      setLoading(false)
      setError(null)
    } else {
      setData(null)
      setLoading(true)
      setError(null)
    }
  }, [path, enabled, ttl])

  useEffect(() => {
    if (!enabled) return
    // 방금 캐시로 채웠다면 재fetch 스킵(동시 마운트 시 불필요한 호출 제거).
    if (!readFreshCache(path, ttl)) fetchData()

    if (!interval) return

    // path 단위 단일 스케줄러에 구독. 같은 (path, interval)을 쓰는 다른
    // 인스턴스와 타이머/visibility 리스너를 공유한다.
    const unsubscribe = subscribeScheduler(
      path,
      interval,
      (result, ts) => {
        setData(result)
        setFetchedAt(ts)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [fetchData, interval, enabled, ttl, path])

  return { data, loading, error, fetchedAt, refetch: fetchData }
}
