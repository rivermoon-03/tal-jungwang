import { useState, useEffect, useRef } from 'react'
import { TrainFront, ChevronLeft, Map } from 'lucide-react'
import { useSubwayTimetable, useSubwayRealtime } from '../../hooks/useSubway'
import useAppStore from '../../stores/useAppStore'
import SubwayLineCard from './SubwayLineCard'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'
import SubwayRealtimeBoard from './SubwayRealtimeBoard'
import { RealtimeCompactCard } from './SubwayRealtimeCard'
import { getLastTrainStatus, getSpecialTrainIndices } from '../../utils/trainTime'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function getNextDestination(trains) {
  if (!trains?.length) return null
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  return trains.find((t) => timeToMinutes(t.depart_at) > nowMin)?.destination ?? null
}

function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

// 역별 카드 정의
const STATION_GROUPS = [
  {
    stationName: '정왕역',
    cards: [
      { key: 'line4_up',   lineName: '4호선',    upDown: '상행', fallback: '당고개', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'line4_down', lineName: '4호선',    upDown: '하행', fallback: '오이도', color: '#1B5FAD', darkColor: '#60a5fa', lightColor: '#E8F0FB' },
      { key: 'up',         lineName: '수인분당선', upDown: '상행', fallback: '왕십리', color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
      { key: 'down',       lineName: '수인분당선', upDown: '하행', fallback: '인천',   color: '#F5A623', darkColor: '#fbbf24', lightColor: '#FEF6E6' },
    ],
  },
  {
    stationName: '초지역',
    cards: [
      { key: 'choji_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'choji_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
  {
    stationName: '시흥시청역',
    cards: [
      { key: 'siheung_up', lineName: '서해선', upDown: '상행', fallback: '대곡/일산', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
      { key: 'siheung_dn', lineName: '서해선', upDown: '하행', fallback: '원시', color: '#75bf43', darkColor: '#75bf43', lightColor: '#f2fde6' },
    ],
  },
]

const ALL_CARD_DEFS = STATION_GROUPS.flatMap((g) => g.cards)

function useLastTrainWarnings(timetable) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick

  if (!timetable) return []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  return ALL_CARD_DEFS.flatMap((def) => {
    const trains = timetable[def.key] ?? []
    const status = getLastTrainStatus(trains, nowMin)
    if (!status?.isLast) return []
    const [hh, mm] = status.nextTrain.depart_at.split(':').map(Number)
    let rawMin = hh * 60 + mm
    if (rawMin < 3 * 60 && nowMin > 22 * 60) rawMin += 1440
    const diffMin = rawMin - nowMin
    if (diffMin > 30) return []
    return [{ lineName: def.lineName, upDown: def.upDown, destination: status.nextTrain.destination, diffMin }]
  })
}

function LastTrainBanner({ warnings }) {
  if (warnings.length === 0) return null
  return (
    <div className="mx-4 mt-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-3">
      <p className="text-xs font-extrabold text-red-500 uppercase tracking-wide mb-1.5">막차 임박</p>
      <div className="flex flex-col gap-1">
        {warnings.map((w, i) => (
          <p key={i} className="text-sm text-red-700 dark:text-red-400">
            <span className="font-bold">{w.lineName} {w.upDown}</span>
            {' · '}{w.destination} 방면 — <span className="font-bold tabular-nums">{w.diffMin}분 후</span> 막차
          </p>
        ))}
      </div>
    </div>
  )
}

const STATION_TABS = STATION_GROUPS.map((g) => g.stationName)

// 역 탭명 → 실시간 데이터 키
const STATION_REALTIME_KEY = {
  '정왕역': '정왕',
  '초지역': '초지',
  '시흥시청역': '시흥시청',
}

// 역 탭명 → SubwayLineMap viewStation
const STATION_VIEW = {
  '정왕역': '정왕',
  '초지역': '초지',
  '시흥시청역': '시흥시청',
}

// 시간표 모드 실시간 요약에 사용하는 노선 메타
const LINE_META_COMPACT = {
  '4호선':    { symbol: '4', color: '#1B5FAD' },
  '수인분당선': { symbol: '수', color: '#F5A623' },
  '서해선':   { symbol: '서', color: '#75bf43' },
}

// ── 통합 상세 뷰 ─────────────────────────────────────────────────────────────
function UnifiedDetail({ card, realtimeTrain, timetable, loading, onBack, viewStation }) {
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)

  const trains = timetable?.[card.key] ?? []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  const titleDest = realtimeTrain
    ? realtimeTrain.destination
    : (getNextDestination(trains) ?? card.fallback)

  // 실시간 열차 상태 표시
  const renderRealtimeStatus = () => {
    if (!realtimeTrain) return null
    const secs = realtimeTrain.arrive_seconds
    const isImminent = [0, 1, 5].includes(realtimeTrain.status_code)
    let etaLabel
    if (isImminent) etaLabel = '곧 도착'
    else if (secs != null && secs >= 0) {
      const mins = Math.ceil(secs / 60)
      etaLabel = mins <= 0 ? '곧 도착' : `${mins}분 후`
    } else {
      etaLabel = cleanMsg(realtimeTrain.location_msg) || cleanMsg(realtimeTrain.status_msg) || '운행 중'
    }

    return (
      <div className="mx-4 mt-3 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">이 열차 실시간</p>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {realtimeTrain.destination}행
            </span>
            {realtimeTrain.is_last_train && (
              <span className="ml-1.5 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">막차</span>
            )}
            {realtimeTrain.train_type && realtimeTrain.train_type !== '일반' && realtimeTrain.train_type !== '' && (
              <span className="ml-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                style={{ background: card.color }}>{realtimeTrain.train_type}</span>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {cleanMsg(realtimeTrain.status_msg) || ''}{realtimeTrain.location_msg ? ` · ${cleanMsg(realtimeTrain.location_msg)}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-lg font-black"
              style={{ color: isImminent ? '#dc2626' : card.color }}
            >
              {etaLabel}
            </span>
            <button
              onClick={() => setSubwayLineSheet(realtimeTrain)}
              className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <Map size={12} />
              노선도
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full animate-slide-in-right">
      {/* 헤더 */}
      <div
        className="flex items-center gap-2 text-white px-4 py-4 flex-shrink-0"
        style={{ backgroundColor: card.color }}
      >
        <button onClick={onBack} className="p-0.5 -ml-1 rounded">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold flex-1 truncate">
          {card.lineName} · {card.upDown} · {titleDest} 방면
        </h2>
      </div>

      {/* 실시간 상태 (열차 클릭 시) */}
      {renderRealtimeStatus()}

      {/* 카운트다운 */}
      <SubwayCountdown nextTrain={nextTrain} lineColor={card.color} lineDarkColor={card.darkColor} />

      {/* 시간표 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : (
        <SubwayTimetable
          entries={trains}
          nextIndex={nextIndex}
          lastIdx={lastIdx ?? null}
          firstIdx={firstIdx ?? null}
          lineColor={card.color}
          lineDarkColor={card.darkColor}
          lineLightColor={card.lightColor}
        />
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function SubwayTab() {
  // selectedDetail = { card, realtimeTrain: null | item } | null
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [stationTab, setStationTab] = useState(STATION_TABS[0])
  const [modeTab, setModeTab] = useState('realtime')
  const didAutoSwitchRef = useRef(false)
  const { data: timetable, loading } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading } = useSubwayRealtime()
  const lastTrainWarnings = useLastTrainWarnings(timetable)

  const realtimeArrivals = realtimeAll?.[STATION_REALTIME_KEY[stationTab]] ?? null
  const activeGroup = STATION_GROUPS.find((g) => g.stationName === stationTab) ?? STATION_GROUPS[0]

  // 역 탭이 바뀔 때 상세뷰/모드 전체 초기화
  useEffect(() => {
    setModeTab('realtime')
    setSelectedDetail(null)
    didAutoSwitchRef.current = false
  }, [stationTab])

  // 실시간 데이터 없음 → 시간표 자동 전환, 데이터 복구 시 실시간 복귀
  useEffect(() => {
    if (!realtimeLoading && realtimeArrivals !== null) {
      if (realtimeArrivals.length === 0 && !didAutoSwitchRef.current) {
        didAutoSwitchRef.current = true
        setModeTab('timetable')
      } else if (realtimeArrivals.length > 0 && didAutoSwitchRef.current) {
        didAutoSwitchRef.current = false
        setModeTab('realtime')
      }
    }
  }, [realtimeArrivals, realtimeLoading])

  // 실시간 열차 클릭 → 매칭 카드 찾아 통합 상세 오픈
  const openRealtimeDetail = (item) => {
    const card = activeGroup.cards.find(
      (c) => c.lineName === item.line && c.upDown === item.direction
    ) ?? null
    if (card) {
      setSelectedDetail({ card, realtimeTrain: item })
    }
    // card 없으면 무시 (해당 역에 없는 노선/방향)
  }

  // 통합 상세 뷰
  if (selectedDetail) {
    return (
      <UnifiedDetail
        card={selectedDetail.card}
        realtimeTrain={selectedDetail.realtimeTrain}
        timetable={timetable}
        loading={loading}
        onBack={() => setSelectedDetail(null)}
        viewStation={STATION_VIEW[stationTab]}
      />
    )
  }

  // ── 카드 목록 뷰 ─────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4">
        <TrainFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">지하철</h2>
      </div>

      {/* 역 탭 */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        {STATION_TABS.map((name) => (
          <button
            key={name}
            onClick={() => setStationTab(name)}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              stationTab === name
                ? 'bg-navy text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* 실시간/시간표 모드 탭 */}
      <div className="flex gap-1.5 px-4 pt-2 pb-1">
        {['realtime', 'timetable'].map((mode) => (
          <button
            key={mode}
            onClick={() => setModeTab(mode)}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              modeTab === mode
                ? 'bg-navy text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {mode === 'realtime' ? '실시간' : '시간표'}
          </button>
        ))}
      </div>

      {/* 콘텐츠 영역 */}
      {modeTab === 'realtime' ? (
        realtimeLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-base text-slate-400">불러오는 중...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
            <SubwayRealtimeBoard
              arrivals={realtimeArrivals}
              onRowClick={openRealtimeDetail}
            />
          </div>
        )
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
          {/* 시간표 모드 실시간 요약 — 데이터 있을 때만 */}
          {realtimeArrivals && realtimeArrivals.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">실시간 현황</p>
              <div className="flex flex-col gap-2">
                {[...new Set(realtimeArrivals.map((a) => a.line))].map((lineName) => {
                  const meta = LINE_META_COMPACT[lineName] ?? { symbol: lineName[0], color: '#6b7280' }
                  const up = realtimeArrivals.find((a) => a.line === lineName && a.direction === '상행') ?? null
                  const down = realtimeArrivals.find((a) => a.line === lineName && a.direction === '하행') ?? null
                  return (
                    <RealtimeCompactCard
                      key={lineName}
                      lineName={lineName}
                      symbol={meta.symbol}
                      color={meta.color}
                      upTrain={up}
                      downTrain={down}
                      onTrainClick={openRealtimeDetail}
                    />
                  )
                })}
              </div>
              <div className="mt-3 border-t border-slate-100 dark:border-slate-800" />
            </div>
          )}
          <LastTrainBanner warnings={lastTrainWarnings} />
          <div className="p-4 flex flex-col gap-3">
            {activeGroup.cards.map((card) => {
              const dest = getNextDestination(timetable?.[card.key]) ?? card.fallback
              return (
                <SubwayLineCard
                  key={card.key}
                  lineName={card.lineName}
                  dirLabel={`${card.upDown} · ${dest} 방면`}
                  color={card.color}
                  darkColor={card.darkColor}
                  lightColor={card.lightColor}
                  trains={timetable?.[card.key] ?? []}
                  onClick={() => setSelectedDetail({ card, realtimeTrain: null })}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
