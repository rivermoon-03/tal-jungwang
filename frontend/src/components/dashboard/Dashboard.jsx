import { useEffect, useRef } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import useBusStationAutoSelect from '../../hooks/useBusStationAutoSelect'
import ModeTabs from './ModeTabs'
import StationPills from './StationPills'
import BusPanel from '../summary/BusPanel'
import SubwayPanel from '../summary/SubwayPanel'
import ShuttlePanel from '../summary/ShuttlePanel'
import TaxiPanel from '../summary/TaxiPanel'
import HomeBriefing from './HomeBriefing'
import SchedulePage from '../schedule/SchedulePage'
import { BUS_STATION_LABELS, getAllowedDirections } from './busStationConfig'

/**
 * Dashboard — 스냅 하단 영역. 모드 탭 + 방향 행 + 정류장 chip + 활성 패널 렌더.
 *
 * 스토어에서 selectedMode만 구독한다. 패널들은 자체적으로
 * selectedBusStation/selectedBusDirection / selectedSubwayStation 등을 구독한다.
 *
 * 높이는 부모(MainShell)가 제어하므로 자체적으로 overflow-auto 한다.
 *
 * 지금/시간표 전환: 예전엔 이 화면 안에 ViewSwitch(SegmentedControl) 셀렉터가
 * 따로 있어, 독의 "시간표" 탭과 화면 안 셀렉터가 같은 homeView를 두 군데서
 * 조작했다 — 독에서 시간표를 눌러도 셀렉터가 "지금"에 남아 있는 등 서로
 * 어긋나 보였다(사용자 실측). 셀렉터는 없앴고, 독의 홈/시간표 탭이 그 자리를
 * 대신한다(FloatingDock.handleNav가 홈 탭 클릭 시 homeView를 'now'로 되돌림).
 */
/**
 * AutoDirectionChip — 하교 화면 단순화(시안): 예전엔 SegmentedControl(등교/하교
 * 두 버튼) + 별도 "자동으로 되돌리기" 칩, 두 조각이 한 행에 있었다. 시안은 이를
 * 칩 하나로 합친다 — "하교 · 자동"처럼 지금 방향과 판정 근거(자동/수동)를 같이
 * 말하고, 탭하면 반대 방향으로 뒤집는다. 판정 로직은 useEffectiveDirection이
 * 이미 시간대·GPS로 계산해 두므로 이 컴포넌트는 그 값을 읽고 뒤집기만 한다.
 *
 * "자동으로 되돌리기" 전용 액션은 없앴다 — directionOverride는 세션 전용(새로고침
 * 시 초기화)이라, 다시 탭해 반대로 뒤집으면 대부분의 경우 자동 판정과 같은
 * 결과로 되돌아온다. 별도 액션 하나를 더 두는 것보다 칩 하나·동작 하나가
 * 하교 화면의 "단순함"에 부합한다.
 */
function AutoDirectionChip() {
  const { direction, isOverride } = useEffectiveDirection()
  const selectedBusStation   = useAppStore((s) => s.selectedBusStation)
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const setBusStation        = useAppStore((s) => s.setBusStation)

  function handleFlip() {
    const next = direction === '하교' ? '등교' : '하교'
    setDirectionOverride(next)
    // 현재 정류장이 새 방향을 허용하지 않으면 해당 방향의 첫 번째 정류장으로 이동
    if (!getAllowedDirections(selectedBusStation).includes(next)) {
      const station = BUS_STATION_LABELS.find((s) => getAllowedDirections(s).includes(next))
      if (station) setBusStation(station)
    }
  }

  return (
    <div className="px-4 pb-1.5">
      <button
        type="button"
        onClick={handleFlip}
        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-pill bg-accent-bg text-accent-ink text-mini-ttl font-bold pressable"
      >
        <ArrowLeftRight size={14} aria-hidden="true" />
        {direction} · {isOverride ? '수동' : '자동'}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const selectedMode = useAppStore((s) => s.selectedMode)
  const homeView = useAppStore((s) => s.homeView)
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)
  const selectedShuttleCampus = useAppStore((s) => s.selectedShuttleCampus)

  // 방향-정류장 정합 보정 + GPS 최근접 자동 선택
  useBusStationAutoSelect()

  const scrollRef = useRef(null)
  const savedScroll = useAppStore((s) => s.dashboardScrollTop)
  const setSavedScroll = useAppStore((s) => s.setDashboardScrollTop)

  // 결함(히어로 아래 하늘 그라데이션이 목록 시작 지점에서 끊겨 보인다). MainShell이
  // 히어로+대시보드를 한 overflow-y-auto 컨테이너에 함께 놓아 "통짜 스크롤"을
  // 만드는데, 이 섹션이 예전 코드처럼 자체 overflow-y-auto를 또 가지면 스크롤
  // 컨테이너가 중첩된다. javascript_tool로 실제 휠 스크롤을 재현해 원인을
  // 확정했다. 중첩 상태에서는 목록 위에서 시작한 스크롤이 안쪽(이 섹션)에서
  // 끝까지 소진돼도 바깥 컨테이너로 체이닝되지 않는다(안쪽 스크롤은 최대치,
  // 정류장 칩과 브리핑 높이만큼인 수십 px에 닿으면 멈추고 더 내려도 반응이 없다).
  // 그래서 사용자가 목록을 아무리 내려도 히어로가 안 빠지고, 히어로가 스크롤
  // 밖에 고정된 것처럼 보이며 그 경계에서 하늘 그라데이션이 끊긴다. 아래에서 이
  // 섹션은 스스로 스크롤을 갖지 않는다(overflow 기본값). 실제 스크롤은 부모
  // (MainShell, "지금" 뷰에서는 항상 오버플로 컨테이너)가 갖고, 이 훅은 그 부모의
  // 스크롤 위치를 구독해 재마운트 시 복원만 담당한다. "시간표" 뷰(아래 첫
  // return)는 SchedulePage가 자체 스크롤을 관리하므로 이 로직과 무관하다.
  // 이 훅은 여전히 조건 없이 호출한다(react-hooks/rules-of-hooks).
  useEffect(() => {
    const scroller = scrollRef.current?.parentElement
    if (!scroller) return
    scroller.scrollTop = savedScroll
    const handleScroll = () => setSavedScroll(scroller.scrollTop)
    scroller.addEventListener('scroll', handleScroll, { passive: true })
    return () => scroller.removeEventListener('scroll', handleScroll)
    // 마운트 시 한 번만 부모를 찾아 구독한다. savedScroll이 바뀔 때마다 다시
    // 구독하면 매 스크롤 이벤트가 스스로 재구독을 유발한다.
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

  // 택시는 시간표라는 개념 자체가 없다 — 세그를 숨기고 항상 "지금"으로 둔다.
  const canShowTimetable = selectedMode !== 'taxi'
  const view = canShowTimetable ? homeView : 'now'

  if (view === 'timetable') {
    return (
      <section className="h-full flex flex-col bg-bg dark:bg-bg" aria-label="대시보드">
        <ModeTabs />
        {/* 시간표는 자체 스크롤 영역(그룹 칩 고정 + 목록 스크롤)을 갖는다.
            바깥에서 한 번 더 스크롤을 걸면 칩이 같이 밀려 올라간다.
            지금/시간표 전환은 더 이상 화면 안 셀렉터가 아니라 하단 독의
            홈/시간표 탭이 맡는다(FloatingDock.handleNav) — viewSwitch는
            건네지 않는다. */}
        <div className="flex-1 min-h-0">
          <SchedulePage embedded />
        </div>
      </section>
    )
  }

  return (
    <section
      ref={scrollRef}
      className="bg-bg dark:bg-bg"
      aria-label="대시보드"
    >
      <ModeTabs />

      {/* 홈 첫 화면 선택 단계 축소(시안 6-A, 사용자 지적) — 예전엔 모드 탭
          다음에 방향 칩·정류장 칩을 먼저 고르고서야 도착 정보가 나와, 열
          때마다 같은 선택(정류장·방향)을 반복했다. 모드 탭(버스/지하철/
          셔틀/택시)만 화면 정체성이라 위에 남기고, 선택 컨트롤(방향 칩·
          정류장 칩)은 목록 아래로 내린다 — 열자마자 자동 선택된 정류장의
          도착 정보가 먼저 보이고, 다른 정류장·방향으로 바꾸고 싶을 때만
          아래로 내려 고치면 된다. "하교 · 자동" 칩과 자동 정류장 선택
          (useBusStationAutoSelect, 위에서 이미 호출)은 그대로 두고 위치만
          옮긴다 — 새 컨트롤을 만들지 않는다. */}
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

      {/* 방향 칩(등하교, 자동/수동) — 정류장 칩 행과 완전히 분리된 줄. 버스 모드에서만 노출. */}
      {selectedMode === 'bus' && <AutoDirectionChip />}

      {/* 정류장 칩 행 — 다음 줄에서 단독으로 가로 스크롤(전체 이름, 잘림 없음). */}
      <StationPills mode={selectedMode} value={stationValue} />

      {/* F1 — 선택 컨트롤 아래 빈 공간에 오늘 브리핑(학사일정 D-day · 오늘 학식) */}
      <HomeBriefing />
    </section>
  )
}
