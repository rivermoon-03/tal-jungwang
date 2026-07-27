import { useNow } from './useNow'

// nowMs를 인자로 받아 순수 함수로 둔다(렌더 중 호출해도 안전).
function parseToSeconds(timeStr, nowMs) {
  const now = new Date(nowMs)
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
  // 공용 tick 훅으로 1초마다 갱신하고 남은 시간은 렌더 중 파생한다. 예전에는
  // 자체 setInterval로 state를 갱신했는데, 훅마다 타이머가 따로 돌고 targetTime이
  // 바뀔 때 effect에서 state를 다시 세팅해야 했다.
  const nowMs = useNow(1000)
  const totalSeconds = targetTime ? parseToSeconds(targetTime, nowMs) : null

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
