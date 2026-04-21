import { Moon } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext } from '../../hooks/useShuttle'
import Skeleton from '../common/Skeleton'
import EmptyState from '../common/EmptyState'
import ErrorState from '../common/ErrorState'
import ArrivalRow from '../dashboard/ArrivalRow'

/**
 * ShuttlePanel — 셔틀 모드 패널
 * 등교(direction=0) / 하교(direction=1) 세로 2행 ArrivalRow.
 * 시간 기반 "현재 활성 방향" 코랄 강조는 제거 — urgent(≤3분) 좌측 바만 사용.
 */

// 셔틀 방향별 출발지·목적지 (MapView의 매핑과 일치: 0=정왕역→학교, 1=학교→정왕역)
const SHUTTLE_DIRECTION_INFO = {
  0: { origin: '정왕역', dest: '한국공대' },
  1: { origin: '한국공대', dest: '정왕역' },
}

export default function ShuttlePanel() {
  return (
    <div className="space-y-2">
      <ShuttleRow direction={0} label="등교" />
      <ShuttleRow direction={1} label="하교" />
    </div>
  )
}

// 백엔드가 "해당 날짜에 운행이 없음"을 의미할 때 돌려주는 오류 코드.
// 이들은 에러가 아닌 운행 종료/미운행 Empty 상태로 표시한다.
const NO_RUN_CODES = new Set(['NO_SHUTTLE', 'NO_SCHEDULE'])

function ShuttleRow({ direction, label }) {
  const setDetailModal = useAppStore((s) => s.setDetailModal)
  const { data, loading, error, refetch } = useShuttleNext(direction)

  if (loading) {
    return <Skeleton height="2.75rem" rounded="rounded-xl" />
  }

  const isNoRun = error && NO_RUN_CODES.has(error.code)

  if (error && !isNoRun) {
    return <ErrorState message={`${label} 정보 오류`} onRetry={refetch} className="py-2" />
  }

  if (isNoRun || !data?.depart_at) {
    return (
      <EmptyState
        icon={<Moon size={24} strokeWidth={1.6} />}
        title="오늘 운행 없음"
        className="py-2"
      />
    )
  }

  const isReturnTrip = !!(data.note?.includes('회차편'))
  // 수시운행: 10분 간격으로 수시 출발이라 분 카운트다운이 의미 없음 → 텍스트 표기로 대체
  const isFrequent = data.note === '수시운행'
  // note 예: "회차편 · 학교 21:20 출발" → HH:MM 추출
  const noteTimeMatch = isReturnTrip ? data.note?.match(/(\d{2}:\d{2})/) : null
  const departTime = noteTimeMatch ? noteTimeMatch[1] : (data.depart_at?.slice(0, 5) ?? null)
  const minutes = isReturnTrip || isFrequent
    ? null
    : data.arrive_in_seconds != null
      ? Math.max(0, Math.ceil(data.arrive_in_seconds / 60))
      : null

  const handleClick = () => {
    // 페이지 이동 없이 현재 화면 위에 상세 시간표 모달을 띄운다 (BusPanel과 동일 패턴).
    setDetailModal({
      type: 'shuttle',
      routeCode: `셔틀${label}`,
      direction,
      favCode: `shuttle:${label}`,
      title: `셔틀버스 ${label}`,
    })
  }

  const dirInfo = SHUTTLE_DIRECTION_INFO[direction]
  const directionText = dirInfo ? `${dirInfo.origin} 출발 · ${dirInfo.dest}행` : null

  return (
    <ArrivalRow
      route={`${label}셔틀`}
      direction={directionText}
      minutes={minutes}
      isUrgent={!isReturnTrip && minutes != null && minutes <= 3}
      returnTrip={isReturnTrip}
      rightAddon={isReturnTrip && departTime
        ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}>
              하교 버스가
            </div>
            <div style={{ fontSize: 13, color: '#b45309', fontWeight: 900, whiteSpace: 'nowrap' }}>
              {departTime} 출발
            </div>
          </div>
        )
        : isFrequent
        ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--tj-ink)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
              수시운행
            </div>
            <div style={{ fontSize: 10, color: 'var(--tj-mute)', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>
              시간 미정
            </div>
          </div>
        )
        : null}
      onClick={handleClick}
    />
  )
}
