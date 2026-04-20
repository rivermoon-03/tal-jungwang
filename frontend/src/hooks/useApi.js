import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/v1'

// 같은 path에 대한 동시 요청은 하나로 합치고(in-flight dedup),
// ttl 동안은 캐시된 응답을 즉시 돌려준다.
// 여러 컴포넌트가 같은 useApi(path)를 쓰면 네트워크 요청은 1회만 발생.
const cache = new Map()      // path -> { data, fetchedAt }
const inflight = new Map()   // path -> Promise<data>

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

    let timerId = setInterval(fetchData, interval)

    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerId)
        timerId = null
      } else {
        fetchData()
        timerId = setInterval(fetchData, interval)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timerId) clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchData, interval, enabled, ttl, path])

  return { data, loading, error, fetchedAt, refetch: fetchData }
}
