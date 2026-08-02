import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import useBusStationAutoSelect from '../../hooks/useBusStationAutoSelect'
import SegmentedControl from '../ui/SegmentedControl.jsx'
import ModeTabs from './ModeTabs'
import StationPills from './StationPills'
import BusPanel from '../summary/BusPanel'
import SubwayPanel from '../summary/SubwayPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import TaxiPanel from '../summary/TaxiPanel'
import HomeBriefing from './HomeBriefing'
import { BUS_STATION_LABELS, getAllowedDirections } from './busStationConfig'

/**
 * Dashboard — 스냅 하단 영역. 모드 탭 + 방향 행 + 정류장 chip + 활성 패널 렌더.
 *
 * 스토어에서 selectedMode만 구독한다. 패널들은 자체적으로
 * selectedBusStation/selectedBusDirection / selectedSubwayStation 등을 구독한다.
 *
 * 높이는 부모(MainShell)가 제어하므로 자체적으로 overflow-auto 한다.
 */
const DIRECTION_OPTIONS = [
  { value: '등교', label: '등교' },
  { value: '하교', label: '하교' },
]

/**
 * BusDirectionRow — 결함 #1/#14/#32/#9: 예전엔 정류장 칩과 등하교 토글이 한 행에
 * 눌려 있어("이마트"가 "이마!"로 잘리는 등) 서로 겹쳤다. 이제 방향 행을 정류장
 * 칩 행과 완전히 분리된 줄로 뺀다 — SegmentedControl(등교/하교) + 우측 자동/수동
 * 상태 칩(자동일 땐 시간대 근거, 수동일 땐 탭해서 자동으로 되돌리는 액션).
 */
function BusDirectionRow() {
  const { direction, isOverride, reason } = useEffectiveDirection()
  const selectedBusStation   = useAppStore((s) => s.selectedBusStation)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const setBusStation        = useAppStore((s) => s.setBusStation)

  function handleChange(value) {
    setDirectionOverride(value)
    // 현재 정류장이 새 방향을 허용하지 않으면 해당 방향의 첫 번째 정류장으로 이동
    if (!getAllowedDirections(selectedBusStation).includes(value)) {
      const next = BUS_STATION_LABELS.find((s) => getAllowedDirections(s).includes(value))
      if (next) setBusStation(next)
    }
  }

  // 자동 판정 근거 문구 — 훅이 알려준 reason을 그대로 쓴다.
  // 예전엔 direction 값만 보고 "등교면 오전"이라고 역추론했는데, 오후에 위치 보정으로
  // 등교가 되면 "오전이라 등교"라는 거짓말이 떴다(제보된 버그).
  const autoReasonText =
    reason === 'location'
      ? (direction === '하교' ? '자동 · 학교 근처라 하교' : '자동 · 학교 밖이라 등교')
      : (direction === '등교' ? '자동 · 오전이라 등교' : '자동 · 오후라서 하교')

  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-1.5">
      <SegmentedControl
        options={DIRECTION_OPTIONS}
        value={direction}
        onChange={handleChange}
        size="sm"
        ariaLabel="등하교 방향"
      />
      {isOverride ? (
        <button
          type="button"
          onClick={() => setDirectionOverride(null)}
          className="shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full bg-accent-bg text-accent-ink pressable"
        >
          수동 · 자동으로 되돌리기
        </button>
      ) : (
        <span className="shrink-0 text-[12px] font-bold px-2.5 py-1 rounded-full bg-accent-bg text-accent-ink">
          {autoReasonText}
        </span>
      )}
    </div>
  )
}

export default function Dashboard() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)
  const selectedShuttleCampus = useAppStore((s) => s.selectedShuttleCampus)

  // 방향-정류장 정합 보정 + GPS 최근접 자동 선택
  useBusStationAutoSelect()

  const scrollRef = useRef(null)
  const savedScroll = useAppStore((s) => s.dashboardScrollTop)
  const setSavedScroll = useAppStore((s) => s.setDashboardScrollTop)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = savedScroll
    // Only restore once on mount; avoid re-triggering on every savedScroll change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  let stationValue = null
  if (selectedMode === 'bus') {
    stationValue = selectedBusStation
  } else if (selectedMode === 'subway') {
    stationValue = selectedSubwayStation
  } else if (selectedMode === 'shuttle') {
    stationValue = selectedShuttleCampus
  } else if (selectedMode === 'taxi') {
    stationValue = null
  }

  return (
    <section
      ref={scrollRef}
      onScroll={(e) => setSavedScroll(e.currentTarget.scrollTop)}
      className="h-full overflow-y-auto bg-bg dark:bg-bg"
      aria-label="대시보드"
    >
      <ModeTabs />

      {/* 방향 행(등하교) — 정류장 칩 행과 완전히 분리된 줄. 버스 모드에서만 노출. */}
      {selectedMode === 'bus' && <BusDirectionRow />}

      {/* 정류장 칩 행 — 다음 줄에서 단독으로 가로 스크롤(전체 이름, 잘림 없음). */}
      <StationPills mode={selectedMode} value={stationValue} />

      <div className="px-4 pb-6">
        {selectedMode === 'bus' && (
          <div key="bus" className="animate-fade-in"><BusPanel /></div>
        )}
        {selectedMode === 'subway' && (
          <div key="subway" className="animate-fade-in"><SubwayPanel dataMode="timetable" /></div>
        )}
        {selectedMode === 'shuttle' && (
          <div key="shuttle" className="animate-fade-in"><ShuttlePanel /></div>
        )}
        {selectedMode === 'taxi' && (
          <div key="taxi" className="animate-fade-in"><TaxiPanel /></div>
        )}
      </div>

      {/* F1 — 도착 카드 아래 빈 공간에 오늘 브리핑(학사일정 D-day · 오늘 학식) */}
      <HomeBriefing />
    </section>
  )
}
