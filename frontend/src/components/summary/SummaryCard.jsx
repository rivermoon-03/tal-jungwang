import { useEffect } from 'react'
import { Bus, TramFront, TrainFront, Car, ChevronUp, ChevronDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import SubwayPanel from './SubwayPanel'
import BusPanel from './BusPanel'
import ShuttlePanel from './ShuttlePanel'
import TaxiPanel from './TaxiPanel'
import { useSubwayNext } from '../../hooks/useSubway'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useBusTimetableByRoute, useBusArrivals } from '../../hooks/useBus'

const SUBWAY_STATION_LINES = {
  정왕:    [{ upKey: 'up',         downKey: 'down',       line: '수인분당선' },
            { upKey: 'line4_up',   downKey: 'line4_down', line: '4호선' }],
  초지:    [{ upKey: 'choji_up',   downKey: 'choji_dn',   line: '서해선' }],
  시흥시청: [{ upKey: 'siheung_up', downKey: 'siheung_dn', line: '서해선' }],
}

const BUS_GROUP_ROUTES = {
  '정왕역': ['20-1', '시흥33'],
  '서울':   ['3400', '6502'],
  '기타':   ['시흥1'],
}
const HANKUK_STOP_ID = '224000639'

function minsFromTimes(times) {
  if (!times?.length) return null
  const now = new Date()
  for (const t of times) {
    if (typeof t !== 'string') continue
    const [h, m] = t.split(':').map(Number)
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    const diff = Math.floor((d.getTime() - now.getTime()) / 1000)
    if (diff >= -60) return Math.ceil(diff / 60)
  }
  return null
}

function realtimeMinsFor(arrivalsData, routeNo) {
  const list = arrivalsData?.arrivals
  if (!list?.length) return null
  const a = list.find((x) => x.route_no === routeNo)
  if (!a || a.arrive_in_seconds == null) return null
  return Math.ceil(a.arrive_in_seconds / 60)
}

const MODE_TABS = [
  { id: 'subway',  label: '지하철', Icon: TrainFront },
  { id: 'bus',     label: '버스',   Icon: Bus },
  { id: 'shuttle', label: '셔틀',   Icon: TramFront },
  { id: 'taxi',    label: '택시',   Icon: Car },
]

/**
 * SummaryCard — 교통수단 요약 카드
 *
 * 펼침: 헤더 + mode pill tabs + 선택된 모드 패널
 * 접힘: floating pill "{모드 아이콘} {노선} {N분}" + ⌄
 *
 * Props:
 *   onNextArrivalChange — (nextArrival) => void  부모(HeroTitleBar)로 다음 도착 정보 전달
 */
export default function SummaryCard({ onNextArrivalChange }) {
  const cardCollapsed  = useAppStore((s) => s.cardCollapsed)
  const toggleCard     = useAppStore((s) => s.toggleCard)
  const selectedMode   = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const selectedBusGroup = useAppStore((s) => s.selectedBusGroup)
  const selectedSubwayStation = useAppStore((s) => s.selectedSubwayStation)

  const ActiveIcon = MODE_TABS.find((t) => t.id === selectedMode)?.Icon ?? Bus
  const modeLabel  = MODE_TABS.find((t) => t.id === selectedMode)?.label ?? '버스'

  // ── 다음 도착 계산 — HeroTitleBar로 전달 ──────────────────────────────
  const { data: subwayData } = useSubwayNext()
  const { data: shuttleUp } = useShuttleNext(0)    // 등교
  const { data: shuttleDown } = useShuttleNext(1)  // 하교

  const routes = BUS_GROUP_ROUTES[selectedBusGroup] ?? ['시흥33']
  const route1 = routes[0] ?? null
  const route2 = routes[1] ?? null
  const { data: busData1 } = useBusTimetableByRoute(route1)
  const { data: busData2 } = useBusTimetableByRoute(route2)
  const { data: realtimeData } = useBusArrivals(
    selectedBusGroup === '정왕역' ? HANKUK_STOP_ID : null,
  )

  useEffect(() => {
    if (!onNextArrivalChange) return

    if (selectedMode === 'subway' && subwayData) {
      const lineKeys = SUBWAY_STATION_LINES[selectedSubwayStation] ?? SUBWAY_STATION_LINES['정왕']
      const trains = []
      for (const { upKey, downKey, line } of lineKeys) {
        const up = subwayData[upKey]
        const down = subwayData[downKey]
        if (up)   trains.push({ ...up,   _dir: '상행', _line: line })
        if (down) trains.push({ ...down, _dir: '하행', _line: line })
      }
      const fastest = trains.sort(
        (a, b) => (a.arrive_in_seconds ?? Infinity) - (b.arrive_in_seconds ?? Infinity),
      )[0]
      if (fastest) {
        const mins = Math.ceil(fastest.arrive_in_seconds / 60)
        const dest = fastest.destination
        const stationLabel = `${selectedSubwayStation}역`
        const headLabel = `${stationLabel} (${fastest._line})${dest ? ` ${dest}` : ''}`
        const pillLabel = `${headLabel} ${mins}분`
        onNextArrivalChange({
          mode: 'subway',
          minutes: mins,
          route: dest ?? '지하철',
          direction: fastest._dir,
          station: stationLabel,
          line: fastest._line,
          headLabel,
          pillLabel,
          subLabel: headLabel,
        })
        return
      }
    }

    if (selectedMode === 'shuttle') {
      const segs = []
      const upMins   = shuttleUp?.arrive_in_seconds   != null ? Math.ceil(shuttleUp.arrive_in_seconds / 60)   : null
      const downMins = shuttleDown?.arrive_in_seconds != null ? Math.ceil(shuttleDown.arrive_in_seconds / 60) : null
      if (upMins   != null) segs.push(`등교 ${upMins}분`)
      if (downMins != null) segs.push(`하교 ${downMins}분`)
      if (segs.length > 0) {
        const fastest = [upMins, downMins].filter((v) => v != null).sort((a, b) => a - b)[0]
        const subSegs = []
        if (upMins   != null) subSegs.push('등교')
        if (downMins != null) subSegs.push('하교')
        onNextArrivalChange({
          mode: 'shuttle',
          minutes: fastest,
          route: '셔틀',
          pillLabel: `셔틀 ${segs.join(' · ')}`,
          subLabel: `셔틀 ${subSegs.join(' · ')}`,
        })
        return
      }
    }

    if (selectedMode === 'bus') {
      const isRealtime = selectedBusGroup === '정왕역'
      const busDataMap = { [route1]: busData1, [route2]: busData2 }
      const segs = []
      const allMins = []
      for (const r of routes) {
        if (!r) continue
        let mins = null
        if (isRealtime) mins = realtimeMinsFor(realtimeData, r)
        if (mins == null) mins = minsFromTimes(busDataMap[r]?.times)
        if (mins != null) {
          segs.push(`${r} ${mins}분`)
          allMins.push(mins)
        }
      }
      if (segs.length > 0) {
        const fastest = Math.min(...allMins)
        const subRoutes = segs.map((s) => s.split(' ')[0])
        onNextArrivalChange({
          mode: 'bus',
          minutes: fastest,
          route: routes[0],
          pillLabel: segs.join(' · '),
          subLabel: subRoutes.join(' · '),
        })
        return
      }
    }

    onNextArrivalChange(null)
  }, [selectedMode, subwayData, shuttleUp, shuttleDown, busData1, busData2, realtimeData, selectedBusGroup, selectedSubwayStation]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 접힘 pill ──────────────────────────────────────────────────────
  if (cardCollapsed) {
    return (
      <div className="px-3 pb-2 pt-2 flex justify-start">
        <button
          onClick={toggleCard}
          aria-label="교통수단 카드 펼치기"
          aria-expanded={false}
          className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md
                     border border-white/60 dark:border-border-dark/60
                     rounded-full shadow-pill text-sm font-semibold text-gray-800 dark:text-gray-100
                     active:scale-95 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-spring)' }}
        >
          <ActiveIcon size={15} aria-hidden="true" />
          <span>{modeLabel}</span>
          <ChevronDown size={15} className="text-gray-400" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // ── 펼침 ──────────────────────────────────────────────────────────
  return (
    <div className="mx-3 mt-2 mb-3 bg-white/95 dark:bg-surface-dark/95 backdrop-blur-md rounded-[24px] shadow-xl overflow-hidden border border-white/60 dark:border-border-dark/60">
      {/* 카드 헤더 — 교통수단 + 접기 버튼만 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={toggleCard}
        role="button"
        aria-expanded={true}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCard()}
      >
        <span className="text-sm font-bold text-gray-800 dark:text-gray-100">교통수단</span>
        <ChevronUp size={18} className="text-gray-400" aria-hidden="true" />
      </div>

      {/* Mode pill tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {MODE_TABS.map(({ id, label, Icon }) => {
          const isActive = selectedMode === id
          return (
            <button
              key={id}
              onClick={() => setSelectedMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors
                ${isActive
                  ? 'shadow-sm'
                  : 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-coral/60'
                }`}
              style={isActive ? { background: '#FF385C', color: '#FFFFFF' } : undefined}
            >
              <Icon size={12} color={isActive ? '#FFFFFF' : undefined} aria-hidden="true" />
              <span style={isActive ? { color: '#FFFFFF' } : undefined}>{label}</span>
            </button>
          )
        })}
      </div>

      {/* 선택된 모드 패널 */}
      <div className="px-4 pb-4">
        {selectedMode === 'subway' && <SubwayPanel />}
        {selectedMode === 'bus'    && <BusPanel />}
        {selectedMode === 'shuttle' && <ShuttlePanel />}
        {selectedMode === 'taxi'   && <TaxiPanel />}
      </div>
    </div>
  )
}
