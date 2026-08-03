import { useApi } from './useApi'

/**
 * B3 — 통학축(정왕동~서울 방면 서해안로 축) 돌발상황(사고·공사) 목록.
 *
 * 백엔드가 cache-aside Redis 20분(빈 결과 10분) + HTTP 5분 캐시이므로
 * 프런트는 5분 폴링이면 충분하다(setInterval 직접 사용 금지 — useApi 공유 타이머).
 * 저하·오류·미승인 모두 빈 배열로 수렴한다 — 홈 버스 패널은 빈 배열이면
 * 아무것도 그리지 않는다(빈 상태 UI 금지).
 */
export function useTrafficIncidents() {
  const { data } = useApi('/traffic/incidents', { interval: 300_000 })
  return { incidents: Array.isArray(data) ? data : [] }
}
