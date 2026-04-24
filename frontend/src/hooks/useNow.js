import { useEffect, useState } from 'react'

// 1초(기본)마다 Date.now()를 리턴하는 공유 tick 훅.
// 탭이 숨겨지면 타이머를 멈추고, 복귀 시 즉시 한 번 갱신한다.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let timerId = setInterval(() => setNow(Date.now()), intervalMs)
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(timerId)
        timerId = null
      } else {
        setNow(Date.now())
        timerId = setInterval(() => setNow(Date.now()), intervalMs)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (timerId) clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
