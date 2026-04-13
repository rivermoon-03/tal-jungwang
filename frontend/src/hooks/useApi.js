import { useState, useEffect, useCallback } from 'react'

const BASE = '/api/v1'

export async function apiFetch(path, options) {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'API error')
  return json.data
}

export function useApi(path, { interval = null, enabled = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
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

  useEffect(() => {
    fetchData()
    if (interval && enabled) {
      const id = setInterval(fetchData, interval)
      return () => clearInterval(id)
    }
  }, [fetchData, interval, enabled])

  return { data, loading, error, fetchedAt, refetch: fetchData }
}
