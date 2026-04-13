import { useState, useEffect } from 'react'

function pad(n) {
  return String(Math.abs(n)).padStart(2, '0')
}

/**
 * Counts down from `initialSeconds` (from API's arrive_in_seconds).
 * Resets whenever initialSeconds changes.
 */
export function useSecondsCountdown(initialSeconds) {
  const [remaining, setRemaining] = useState(initialSeconds ?? null)

  useEffect(() => {
    if (initialSeconds == null) {
      setRemaining(null)
      return
    }
    setRemaining(initialSeconds)
    const id = setInterval(() => {
      setRemaining((prev) => (prev != null ? prev - 1 : null))
    }, 1000)
    return () => clearInterval(id)
  }, [initialSeconds])

  if (remaining == null) {
    return { display: '--:--', totalSeconds: null, isUrgent: false }
  }

  const clamped = Math.max(0, remaining)
  const hours = Math.floor(clamped / 3600)
  const mins = Math.floor((clamped % 3600) / 60)
  const secs = clamped % 60

  // 60분 이상이면 H시간 M분, 아니면 MM:SS
  const display = hours > 0
    ? `${hours}시간 ${pad(mins)}분`
    : `${pad(mins)}:${pad(secs)}`

  return {
    display,
    totalSeconds: remaining,
    isUrgent: remaining >= 0 && remaining < 60,
  }
}

/**
 * arrive_in_seconds로부터 예상 출발 시각 문자열("HH:MM")을 계산
 */
export function estimatedDepartTime(arriveInSeconds) {
  if (arriveInSeconds == null) return '--:--'
  const target = new Date(Date.now() + arriveInSeconds * 1000)
  return `${pad(target.getHours())}:${pad(target.getMinutes())}`
}
