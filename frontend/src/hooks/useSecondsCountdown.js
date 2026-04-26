function pad(n) {
  return String(Math.abs(n)).padStart(2, '0')
}

/**
 * `initialSeconds`를 그대로 MM:SS / H시간 M분 포맷으로 변환한다.
 *
 * 이전에는 내부 setInterval로 매초 직접 1씩 깎았지만, 현재는
 * useBus/useSubway/useShuttle 훅이 useNow(1000) 기반으로 arrive_seconds를
 * 이미 매초 tick 해 준다. 내부 타이머를 또 돌리면 렌더 phase 사이에
 * "두 카운터"가 경쟁해 표시가 튀거나 1초씩 어긋나는 증상이 생긴다.
 *
 * 따라서 이 훅은 이제 **순수 포매터**다. 입력이 변할 때마다 즉시 새 표시.
 */
export function useSecondsCountdown(initialSeconds) {
  if (initialSeconds == null) {
    return { display: '--:--', totalSeconds: null, isUrgent: false }
  }

  const remaining = Math.floor(initialSeconds)
  const clamped = Math.max(0, remaining)
  const hours = Math.floor(clamped / 3600)
  const mins = Math.floor((clamped % 3600) / 60)
  const secs = clamped % 60

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
