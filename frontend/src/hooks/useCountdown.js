import { useState, useEffect } from 'react'

function parseToSeconds(timeStr) {
  const now = new Date()
  const [hh, mm] = timeStr.split(':').map(Number)
  const target = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0
  )
  let diff = Math.floor((target - now) / 1000)
  // If the time appears to be far in the past, it's actually tomorrow
  if (diff < -43200) diff += 86400
  return diff
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export function useCountdown(targetTime) {
  const [totalSeconds, setTotalSeconds] = useState(() =>
    targetTime ? parseToSeconds(targetTime) : null
  )

  useEffect(() => {
    if (!targetTime) {
      setTotalSeconds(null)
      return
    }
    setTotalSeconds(parseToSeconds(targetTime))
    const id = setInterval(() => {
      setTotalSeconds(parseToSeconds(targetTime))
    }, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  if (totalSeconds === null) {
    return { mm: '00', ss: '00', totalSeconds: null, isUrgent: false, isExpired: false }
  }

  // 만료(음수)이면 00:00에 고정
  if (totalSeconds <= 0) {
    return { mm: '00', ss: '00', totalSeconds: 0, isUrgent: false, isExpired: true }
  }

  return {
    mm: pad(Math.floor(totalSeconds / 60)),
    ss: pad(totalSeconds % 60),
    totalSeconds,
    isUrgent: totalSeconds < 60,
    isExpired: false,
  }
}
