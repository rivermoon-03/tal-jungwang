import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/v1'

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

export function useApi(path, { interval = null, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return
    }
    try {
      const result = await apiFetch(path)
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
  useEffect(() => {
    if (enabled) {
      setData(null)
      setLoading(true)
      setError(null)
    }
  }, [path, enabled])

  useEffect(() => {
    fetchData()
    if (!interval || !enabled) return

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
  }, [fetchData, interval, enabled])

  return { data, loading, error, fetchedAt, refetch: fetchData }
}
