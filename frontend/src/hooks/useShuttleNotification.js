import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'shuttle_notification_enabled'
const NOTIFY_BEFORE_MIN = 10

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function useShuttleNotification(timeObjs = []) {
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(STORAGE_KEY) === '1'
  )
  const [permission, setPermission] = useState(
    () => (typeof Notification !== 'undefined' ? Notification.permission : 'denied')
  )

  const toggle = useCallback(async () => {
    if (!enabled) {
      if (permission !== 'granted') {
        const result = await Notification.requestPermission()
        setPermission(result)
        if (result !== 'granted') return
      }
      localStorage.setItem(STORAGE_KEY, '1')
      setEnabled(true)
    } else {
      localStorage.setItem(STORAGE_KEY, '0')
      setEnabled(false)
    }
  }, [enabled, permission])

  useEffect(() => {
    if (!enabled || permission !== 'granted' || timeObjs.length === 0) return

    const check = () => {
      const now = new Date()
      const nowMin = now.getHours() * 60 + now.getMinutes()
      const next = timeObjs.find((t) => toMin(t.depart_at) > nowMin)
      if (!next) return
      const diff = toMin(next.depart_at) - nowMin
      if (diff === NOTIFY_BEFORE_MIN) {
        new Notification('🚌 셔틀 출발 알림', {
          body: `${next.depart_at} 셔틀이 ${NOTIFY_BEFORE_MIN}분 후 출발합니다.`,
          icon: '/favicon.ico',
        })
      }
    }

    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [enabled, permission, timeObjs])

  return { enabled, permission, toggle }
}
