import { useMemo } from 'react'
import { useApi } from './useApi'
import { useNow } from './useNow'
import { tickShuttleNext } from '../utils/tickArrivals'

// 셔틀 시간표는 하루 단위로 정적(서버 Redis TTL 1h)이라 클라이언트에서 공유 캐시.
// 11곳에서 useShuttleSchedule을 호출해도 네트워크 요청은 1회로 합쳐진다.
const SCHEDULE_TTL = 5 * 60 * 1000

// 오늘자 시간표는 기간(학기↔방학↔계절학기) 전환·자정 넘김에 맞춰 재검증해야 한다.
// 지도 컴팩트 띠처럼 오래 마운트된(=재마운트로 재fetch가 안 일어나는) 화면이
// 옛 기간 시간표를 고착하던 회귀(지도=학기 / 홈 탭=계절학기 불일치)를 막는다.
// useApi 스케줄러는 interval이 설정되면 포그라운드 복귀(visibilitychange) 시에도
// 재fetch하므로, 백그라운드에 두었던 PWA가 다음에 켜질 때 즉시 자가회복된다.
// (mistakes.md §4 오래 살아있는 컴포넌트 stale 상태 · §5 캐시 갱신 주기 ≤ 변경 주기)
const SCHEDULE_REFRESH = 30 * 60 * 1000

// direction: 0=등교, 1=하교 (int) | undefined=전체
// dateStr: 'YYYY-MM-DD' | undefined=오늘
export function useShuttleSchedule(direction, dateStr, opts = {}) {
  const params = []
  if (direction !== undefined && direction !== null) params.push(`direction=${direction}`)
  if (dateStr) params.push(`date=${dateStr}`)
  const q = params.length ? `?${params.join('&')}` : ''
  // 특정 날짜를 고정 조회(dateStr)하는 폴백은 정적이라 폴링 불필요. 오늘자만 재검증.
  const interval = dateStr ? undefined : SCHEDULE_REFRESH
  return useApi(`/shuttle/schedule${q}`, { ttl: SCHEDULE_TTL, interval, ...opts })
}

// 방학 중 학기 시간표 — /shuttle/semester-schedule 엔드포인트 (평일 시간표 고정 반환)
// direction 필터 가능. TTL 1시간(학기 시간표는 거의 안 바뀜).
export function useShuttleSemesterSchedule(direction, opts = {}) {
  const q = direction !== undefined && direction !== null ? `?direction=${direction}` : ''
  return useApi(`/shuttle/semester-schedule${q}`, { ttl: 60 * 60 * 1000, ...opts })
}

// tickMs: 분 단위로만 쓰는 지도 마커는 60_000을 넘겨 매초 재계산을 피한다 (기본 1000).
export function useShuttleNext(direction, { tickMs = 1000 } = {}) {
  const q = direction !== undefined && direction !== null ? `?direction=${direction}` : ''
  const { data, loading, error, fetchedAt, refetch } = useApi(`/shuttle/next${q}`, { interval: 15_000 })
  const now = useNow(tickMs)
  const ticked = useMemo(
    () => tickShuttleNext(data, fetchedAt, now),
    [data, fetchedAt, now]
  )
  return { data: ticked, loading, error, fetchedAt, refetch }
}
