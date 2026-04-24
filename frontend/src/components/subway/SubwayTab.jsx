import { useState, useEffect, useRef } from 'react'
import { TrainFront, ChevronLeft, Map, RefreshCw } from 'lucide-react'
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

// ordkey 또는 status_msg에서 남은 정거장 수 추출
function getStationCount(train) {
  if (!train) return null
  const { ordkey, status_msg } = train

  if (ordkey && ordkey.length >= 5) {
    const countStr = ordkey.substring(2, 5)
    const count = parseInt(countStr, 10)
    if (!isNaN(count) && count > 0) return count
  }

  if (status_msg) {
    const match = status_msg.match(/\[?(\d+)\]?번째/)
    if (match) return parseInt(match[1], 10)
  }

  return null
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

// ── 통합 상세 뷰 (Integrated Panel) ───────────────────────────────────────────
function UnifiedDetail({ card, realtimeTrain, directionArrivals = [], timetable, loading, onBack, viewStation, onRefresh, refreshCooldown, realtimeLoading }) {
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)

  const trains = timetable?.[card.key] ?? []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  // 상단에 강조해서 보여줄 열차 (직접 전달받았거나, 방향 목록 전체)
  const realtimeTrains = realtimeTrain ? [realtimeTrain] : directionArrivals

  const titleDest = realtimeTrains.length > 0
    ? realtimeTrains[0].destination
    : (getNextDestination(trains) ?? card.fallback)

  // 실시간 열차 상태 표시
  const renderRealtimeStatus = () => {
    if (!realtimeTrains || realtimeTrains.length === 0) return null

    return (
      <div className="flex flex-col gap-2 mx-4 mt-3">
        {realtimeTrains.map((rtTrain, idx) => {
          const secs = rtTrain.arrive_seconds
          const isImminent = [0, 1, 3, 4, 5].includes(rtTrain.status_code)
          let etaLabel
          if (rtTrain.status_code === 1 || rtTrain.status_code === 2) {
            etaLabel = '이미 도착'
          } else if (rtTrain.status_code === 0) {
            etaLabel = '진입 중'
          } else if (typeof secs === 'number' && secs > 0) {
            const mins = Math.ceil(secs / 60)
            etaLabel = mins <= 0 ? '이미 도착' : `${mins}분 후`
          } else if ([3, 4, 5].includes(rtTrain.status_code)) {
            etaLabel = '곧 도착'
          } else {
            const count = getStationCount(rtTrain)
            if (count != null && count > 0) {
              etaLabel = `${count}역 전`
            } else {
              const msg = cleanMsg(rtTrain.smart_status) || cleanMsg(rtTrain.location_msg) || cleanMsg(rtTrain.status_msg)
              // msg가 역명만 있는 경우(예: '오이도', '초지')를 방지하기 위해 '역 인근'이나 '운행 중'을 조합
              etaLabel = msg ? (msg.endsWith('중') || msg.endsWith('도착') || msg.endsWith('출발') ? msg : `${msg} 인근`) : '운행 중'
            }
          }

          return (
            <div key={rtTrain.train_no || idx} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
              {idx === 0 && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">이 열차 실시간</p>}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {rtTrain.destination}행
                  </span>
                  {rtTrain.is_last_train && (
                    <span className="ml-1.5 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">막차</span>
                  )}
                  {rtTrain.train_type && rtTrain.train_type !== '일반' && rtTrain.train_type !== '' && (
                    <span className="ml-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full"
                      style={{ background: card.color }}>{rtTrain.train_type}</span>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cleanMsg(rtTrain.status_msg) || ''}{rtTrain.location_msg ? ` · ${cleanMsg(rtTrain.location_msg)}` : ''}
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
                    onClick={() => setSubwayLineSheet({ ...rtTrain, viewStation })}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Map size={12} />
                    노선도
                  </button>
                </div>
              </div>
            </div>
          )
        })}
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
        
        {/* 업데이트 버튼 */}
        <button
          onClick={onRefresh}
          disabled={refreshCooldown > 0 || realtimeLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-black/10 text-white hover:bg-black/20 disabled:opacity-50"
        >
          <RefreshCw size={13} className={realtimeLoading ? 'animate-spin' : ''} />
          <span>{refreshCooldown > 0 ? `${refreshCooldown}s` : '업데이트'}</span>
        </button>
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
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [stationTab, setStationTab] = useState(STATION_TABS[0])
  const [modeTab, setModeTab] = useState('realtime')
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  const didAutoSwitchRef = useRef(false)
  
  const { data: timetable, loading } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading, refetch, fetchedAt } = useSubwayRealtime()
  const lastTrainWarnings = useLastTrainWarnings(timetable)

  const realtimeArrivals = realtimeAll?.[STATION_REALTIME_KEY[stationTab]] ?? null
  const activeGroup = STATION_GROUPS.find((g) => g.stationName === stationTab) ?? STATION_GROUPS[0]

  useEffect(() => {
    setModeTab('realtime')
    setSelectedDetail(null)
    didAutoSwitchRef.current = false
  }, [stationTab])

  useEffect(() => {
    if (realtimeLoading) return
    const isEmpty = !realtimeArrivals || realtimeArrivals.length === 0
    if (isEmpty && !didAutoSwitchRef.current) {
      didAutoSwitchRef.current = true
      setModeTab('timetable')
    } else if (realtimeArrivals && realtimeArrivals.length > 0 && didAutoSwitchRef.current) {
      didAutoSwitchRef.current = false
      setModeTab('realtime')
    }
  }, [realtimeArrivals, realtimeLoading])

  const openRealtimeDetail = (item) => {
    const card = activeGroup.cards.find(
      (c) => c.lineName === item.line && c.upDown === item.direction
    ) ?? null
    if (card) {
      setSelectedDetail({ card, realtimeTrain: item })
    }
  }

  const handleManualRefresh = async () => {
    if (refreshCooldown > 0) return
    await refetch()
    setRefreshCooldown(10)
  }

  useEffect(() => {
    if (refreshCooldown <= 0) return
    const id = setInterval(() => setRefreshCooldown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [refreshCooldown])

  if (selectedDetail) {
    const directionArrivals = realtimeArrivals?.filter(
      (a) => a.line === selectedDetail.card.lineName && a.direction === selectedDetail.card.upDown
    ) ?? []

    return (
      <UnifiedDetail
        card={selectedDetail.card}
        realtimeTrain={selectedDetail.realtimeTrain}
        directionArrivals={directionArrivals}
        timetable={timetable}
        loading={loading}
        onBack={() => setSelectedDetail(null)}
        viewStation={STATION_VIEW[stationTab]}
        onRefresh={handleManualRefresh}
        refreshCooldown={refreshCooldown}
        realtimeLoading={realtimeLoading}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between bg-navy text-white px-5 py-4">
        <div className="flex items-center gap-2">
          <TrainFront size={20} strokeWidth={2} />
          <h2 className="text-lg font-bold">지하철</h2>
        </div>
        
        <button
          onClick={handleManualRefresh}
          disabled={refreshCooldown > 0 || realtimeLoading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
            refreshCooldown > 0 ? 'bg-white/10 text-white/40' : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          <RefreshCw size={14} className={realtimeLoading ? 'animate-spin' : ''} />
          <span>{refreshCooldown > 0 ? `${refreshCooldown}s` : '업데이트'}</span>
        </button>
      </div>

      <div className="flex gap-1.5 px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-800">
        {STATION_TABS.map((name) => (
          <button
            key={name}
            onClick={() => setStationTab(name)}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              stationTab === name ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 px-4 pt-2 pb-1">
        {['realtime', 'timetable'].map((mode) => (
          <button
            key={mode}
            onClick={() => setModeTab(mode)}
            className={`pressable px-3 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              modeTab === mode ? 'bg-navy text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {mode === 'realtime' ? '실시간 (베타)' : '시간표'}
          </button>
        ))}
      </div>

      {modeTab === 'realtime' ? (
        realtimeLoading ? (
          <div className="flex-1 flex items-center justify-center"><p className="text-base text-slate-400">불러오는 중...</p></div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
            <SubwayRealtimeBoard arrivals={realtimeArrivals} lastFetchedAt={fetchedAt} onRowClick={openRealtimeDetail} />
          </div>
        )
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center"><p className="text-base text-slate-400">불러오는 중...</p></div>
      ) : (
        <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
          {realtimeArrivals && realtimeArrivals.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">실시간 현황 (베타)</p>
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
                      lastFetchedAt={fetchedAt}
                      onTrainClick={openRealtimeDetail}
                      stationName={stationTab?.replace(/역$/, '')}
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
