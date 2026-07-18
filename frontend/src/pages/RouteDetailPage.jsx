import { useState, useMemo, useEffect, useRef } from 'react'
import { Star, ChevronLeft, Bus } from 'lucide-react'
import { useBusTimetableByRoute, useBusHistoryPreview, useBusRoutes } from '../hooks/useBus'
import useFavorites from '../hooks/useFavorites'
import RouteBadge from '../components/ui/RouteBadge'
import StatusChip from '../components/ui/StatusChip'
import EmptyState from '../components/ui/EmptyState'
import ArrivalHistory from '../components/bus/ArrivalHistory'
import RouteCrowdingSection from '../components/stats/RouteCrowdingSection'
import { toHistoryRows } from '../utils/historyAdapter'
import { getGbisStationId } from '../components/dashboard/busStationConfig'

// ──────────────────────────────────────────────────────────────────
// 헬퍼: "HH:MM" 문자열을 오늘 기준 총 분으로 변환
// ──────────────────────────────────────────────────────────────────
function timeToMinutes(timeStr) {
  const [hh, mm] = (timeStr ?? '').split(':').map(Number)
  if (isNaN(hh) || isNaN(mm)) return Infinity
  return hh * 60 + mm
}

function nowMinutes() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

function deltaLabel(departAt, nowMin) {
  const depMin = timeToMinutes(departAt)
  const diff = depMin - nowMin
  if (diff <= 0) return null
  if (diff <= 1) return '곧 출발'
  return `${diff}분 뒤`
}

// ──────────────────────────────────────────────────────────────────
// 실시간 ETA 포맷: arrive_in_seconds → 라벨 문자열
// ──────────────────────────────────────────────────────────────────
function etaLabel(sec) {
  if (sec == null) return null
  if (sec <= 90) return '곧 도착'
  return `${Math.ceil(sec / 60)}분`
}

// ──────────────────────────────────────────────────────────────────
// 탭 상수
// ──────────────────────────────────────────────────────────────────
const DAY_TABS = [
  { id: 'weekday',  label: '평일' },
  { id: 'saturday', label: '토요일' },
  { id: 'sunday',   label: '일요일' },
]

// 오늘 요일로 기본 탭 결정 (0=일,1=월..6=토)
function defaultDayTab() {
  const dow = new Date().getDay()
  if (dow === 0) return 'sunday'
  if (dow === 6) return 'saturday'
  return 'weekday'
}

// ──────────────────────────────────────────────────────────────────
// 실시간 도착 카드 (is_realtime=true 노선 전용)
// historyPreview의 realtime_eta 또는 arrivals 기반
// stopName: histData.stop_name (내 정류장 = 도착 지점)
// ──────────────────────────────────────────────────────────────────
function RealtimeArrivalCard({ histData, histLoading }) {
  const realtimeEta = histData?.realtime_eta ?? null

  if (histLoading) {
    return (
      <div
        className="flex items-center gap-3 bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <span className="text-[14px] font-semibold text-mute dark:text-mute">
          실시간 도착 정보를 가져오는 중이에요
        </span>
      </div>
    )
  }

  if (!histData) {
    return (
      <div
        className="flex items-center gap-3 bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3"
        role="status"
      >
        <span className="text-[14px] font-semibold text-mute dark:text-mute">
          실시간 도착 정보를 가져오는 중이에요
        </span>
      </div>
    )
  }

  // realtime_eta 있으면 우선 표시
  if (realtimeEta) {
    const primary = realtimeEta.primary
    const secondary = realtimeEta.secondary
    const primaryLabel = etaLabel(primary?.arrive_in_seconds)
    const secondaryLabel = secondary ? etaLabel(secondary.arrive_in_seconds) : null

    return (
      <div
        className="bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <span className="block text-[11px] font-semibold tracking-[.06em] text-accent uppercase mb-0.5">
              실시간 도착
            </span>
            <span className="block text-[22px] font-bold text-ink dark:text-ink leading-tight tabular-nums">
              {primaryLabel ?? '—'}
            </span>
            {primary?.arrive_at_hhmm && (
              <span className="block text-[11.5px] font-semibold text-mute dark:text-mute mt-0.5">
                {primary.arrive_at_hhmm} 도착 예정
              </span>
            )}
          </div>
          {secondaryLabel && (
            <div className="flex-none text-right pl-3 border-l border-accent/20 dark:border-accent/25">
              <span className="block text-[11px] font-semibold text-mute mb-0.5">다음 차</span>
              <span className="block text-[17px] font-semibold text-ink dark:text-ink tabular-nums">{secondaryLabel}</span>
              {secondary?.arrive_at_hhmm && (
                <span className="block text-[11px] font-semibold text-mute">{secondary.arrive_at_hhmm}</span>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // realtime_eta 없음 — 예측 시각 표시 금지, 중립 안내만 표시
  return (
    <div
      className="flex items-center gap-3 bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3"
      role="status"
    >
      <span className="text-[14px] font-semibold text-mute dark:text-mute">
        실시간 도착 정보가 없어요
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// 실시간 인라인 라이브 행 (시안3의 핵심)
// "중간 정류장 도착 예정" 개념임을 명확히 표시
// is_realtime=true 노선에서만 사용
// ──────────────────────────────────────────────────────────────────
function InlineLiveRow({ liveData }) {
  if (!liveData) return null
  const { arrive_in_seconds, depart_at, stop_name } = liveData

  let eta = ''
  if (arrive_in_seconds != null) {
    if (arrive_in_seconds <= 90) eta = '곧 도착'
    else eta = `~${Math.ceil(arrive_in_seconds / 60)}분`
  }

  const arrivalStopLabel = stop_name ? `${stop_name} 도착 예정` : '도착 예정'
  const timeLabel = depart_at ? `${depart_at} 출발 예정` : '실시간 추적 중'

  return (
    <div
      className="flex items-center gap-3 bg-accent-bg border-y border-accent/25 dark:border-accent/35 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span className="flex-none w-9 h-9 rounded-button bg-accent flex items-center justify-center shadow-[0_4px_10px_color-mix(in_srgb,var(--tj-accent)_40%,transparent)]">
        <Bus size={18} className="text-white" />
      </span>
      <div className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold text-imminent leading-tight tracking-[-0.01em]">
          {arrivalStopLabel}
        </span>
        <span className="block text-[11.5px] font-semibold text-accent mt-0.5">
          {timeLabel}
        </span>
      </div>
      {eta && (
        <div className="flex-none text-right pl-3 border-l border-accent/20 dark:border-accent/25">
          <span className="block text-[15px] font-bold text-ink tabular-nums">{eta}</span>
          <span className="block text-[11px] font-bold text-mute mt-0.5">다음 차</span>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// 시간표 행 (일반 + 과거 + 막차)
// ──────────────────────────────────────────────────────────────────
function TimetableRow({ entry, nowMin, isNext = false }) {
  const depMin = timeToMinutes(entry.depart_at)
  const isPast = depMin < nowMin
  const delta = deltaLabel(entry.depart_at, nowMin)

  return (
    <div
      className={[
        'flex items-center gap-3 px-4 py-[9px] border-t border-line dark:border-line',
        isPast ? 'opacity-50' : '',
        isNext ? 'bg-accent-bg' : '',
      ].filter(Boolean).join(' ')}
    >
      <span
        className={[
          'min-w-[62px] tabular-nums tracking-[-0.01em]',
          isPast
            ? 'text-[15px] font-bold text-mute'
            : isNext
              ? 'text-[16px] font-bold text-accent-ink'
              : 'text-[16px] font-semibold text-ink-2',
        ].join(' ')}
      >
        {entry.depart_at}
      </span>

      {entry.note && (
        <span className="flex-1 text-[12px] font-semibold text-mute truncate">
          {entry.note}
        </span>
      )}
      {!entry.note && <span className="flex-1" />}

      {entry.is_last ? (
        <StatusChip kind="last">막차</StatusChip>
      ) : isNext ? (
        <span className="text-[11px] font-semibold text-accent-ink px-[9px] py-[3px] rounded-full bg-accent/15">
          다음 차{delta ? ` (${delta})` : ''}
        </span>
      ) : isPast ? (
        <span className="text-[11px] font-semibold text-mute/70">지난 차</span>
      ) : delta ? (
        <span className="text-[11px] font-semibold text-mute">{delta}</span>
      ) : null}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// API 응답 어댑터
// 백엔드는 { times: ["HH:MM", ...], schedule_type, notes } 형태로 응답.
// RouteDetailPage는 { timetable: { weekday: [{depart_at, note, is_last}] } } 구조를 기대.
// times 배열 형태일 때 현재 요청한 schedule_type 키로 변환해 반환.
// ──────────────────────────────────────────────────────────────────
function adaptTimetableResponse(raw) {
  if (!raw) return raw
  // 이미 timetable 객체 형태면 그대로 반환
  if (raw.timetable && typeof raw.timetable === 'object') return raw
  // times 배열 형태 → timetable 구조로 변환
  if (Array.isArray(raw.times)) {
    const dayKey = raw.schedule_type ?? 'weekday'
    const rows = raw.times.map((t, i) => ({
      depart_at: t,
      note: raw.notes?.[i] ?? null,
      is_last: false,
    }))
    // 마지막 행을 막차로 표시
    if (rows.length > 0) rows[rows.length - 1].is_last = true
    const timetable = { weekday: [], saturday: [], sunday: [] }
    timetable[dayKey] = rows
    return {
      ...raw,
      route_no: raw.route_name ?? raw.route_no,
      stops: raw.stops ?? [],
      timetable,
      first_bus: rows[0]?.depart_at ?? null,
      last_bus: rows[rows.length - 1]?.depart_at ?? null,
      total_trips: rows.length > 0 ? rows.length : null,
    }
  }
  return raw
}

// ──────────────────────────────────────────────────────────────────
// 방향 탭: 한 노선번호에 등교/하교 route가 둘 이상일 때 표시
// ──────────────────────────────────────────────────────────────────
const CATEGORY_LABELS = {
  '등교': '등교',
  '하교': '하교',
}

function DirectionTabs({ categories, active, onChange }) {
  if (!categories || categories.length <= 1) return null
  return (
    <div
      role="tablist"
      aria-label="방향 선택"
      className="flex gap-[5px] bg-surface-2 dark:bg-bg border border-line dark:border-line rounded-card p-1 mb-[10px]"
    >
      {categories.map((cat) => {
        const isActive = cat === active
        return (
          <button
            key={cat}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(cat)}
            className={[
              'flex-1 flex items-center justify-center min-h-[38px] rounded-button',
              'text-[14px] font-semibold select-none transition-all',
              isActive
                ? 'bg-ink dark:bg-accent text-white dark:text-black font-semibold shadow-[0_4px_10px_color-mix(in_srgb,var(--tj-ink)_22%,transparent)]'
                : 'text-mute dark:text-mute',
            ].join(' ')}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// 메인 RouteDetailPage 컴포넌트
// stop: busStationConfig 키 (예: '시흥시청', '서울'). 없으면 기존 동작.
//   - gbisStationId 있는 stop: 도착 정보 그룹만 표시
//   - gbisStationId null인 stop: 출발 시간표 그룹만 표시
//   - stop 없음: 두 그룹 모두 표시 (기존)
// ──────────────────────────────────────────────────────────────────
export default function RouteDetailPage({ routeNumber, initialCategory, stop = null }) {
  // stop prop에 따른 표시 분기 계산
  const stopGbisId = stop ? getGbisStationId(stop) : undefined
  // stopGbisId가 undefined이면 stop prop 없음 → 기존 동작(둘 다 표시)
  // stopGbisId가 string이면 GBIS 정류장 → 도착 정보만
  // stopGbisId가 null이면 시간표 전용 정류장 → 출발 시간표만
  const showArrivalGroup = stop === null || stop === undefined
    ? true                        // stop 없음: 기존 동작 (is_realtime 노선이면 표시)
    : stopGbisId != null          // GBIS 정류장이면 도착 정보 표시
  const showTimetableGroup = stop === null || stop === undefined
    ? true                        // stop 없음: 기존 동작 (항상 표시)
    : stopGbisId == null          // 시간표 전용 정류장이면 출발 시간표 표시
  const [dayTab, setDayTab] = useState(defaultDayTab)
  const [activeStop, setActiveStop] = useState(null)

  // 전체 routes 목록에서 해당 routeNumber의 방향 목록 파악
  const { data: allRoutesData } = useBusRoutes()
  const availableCategories = useMemo(() => {
    if (!allRoutesData) return []
    const matched = (Array.isArray(allRoutesData) ? allRoutesData : allRoutesData?.routes ?? [])
      .filter((r) => r.route_number === routeNumber && r.category)
      .map((r) => r.category)
    // 고유값, 등교 우선 정렬
    const unique = [...new Set(matched)]
    unique.sort((a, b) => {
      const order = ['등교', '하교']
      return (order.indexOf(a) ?? 99) - (order.indexOf(b) ?? 99)
    })
    return unique
  }, [allRoutesData, routeNumber])

  // 방향 탭 기본값: initialCategory → 실시간 방향 우선 → 첫 번째
  const defaultCategory = useMemo(() => {
    if (initialCategory && availableCategories.includes(initialCategory)) return initialCategory
    if (availableCategories.length === 0) return null
    // 실시간 방향 우선
    const realtimeCat = (Array.isArray(allRoutesData) ? allRoutesData : allRoutesData?.routes ?? [])
      .find((r) => r.route_number === routeNumber && r.is_realtime && r.category)
    if (realtimeCat && availableCategories.includes(realtimeCat.category)) return realtimeCat.category
    return availableCategories[0]
  }, [initialCategory, availableCategories, allRoutesData, routeNumber])

  const [activeCategory, setActiveCategory] = useState(null)

  // defaultCategory가 처음 확정되는 시점(null → 값)에 activeCategory를 세팅.
  // 이를 통해 allRoutesData 로딩 완료 후 defaultCategory가 바뀌어도
  // useBusTimetableByRoute에 전달되는 category가 변경되지 않아 불필요한 재fetch/깜빡임을 방지.
  useEffect(() => {
    if (activeCategory === null && defaultCategory !== null) {
      setActiveCategory(defaultCategory)
    }
  }, [defaultCategory, activeCategory])

  // resolvedCategory: 사용자가 탭을 선택했거나 effect로 세팅된 값, 아직 없으면 defaultCategory 폴백
  const resolvedCategory = activeCategory ?? defaultCategory

  // 노선 번호로 시간표 조회 — 탭 전환 시 schedule_type + category 파라미터 전달
  const { data: ttRaw, loading: ttLoading, error: ttError } = useBusTimetableByRoute(routeNumber, {
    scheduleType: dayTab,
    category: resolvedCategory ?? undefined,
  })
  const ttData = useMemo(() => adaptTimetableResponse(ttRaw), [ttRaw])

  // is_realtime 플래그 (시간표 응답에서 직접 읽기)
  const isRealtime = ttData?.is_realtime ?? false

  // 시간표 그룹 표시 여부 (실제 렌더용).
  // GBIS 정류장(stopGbisId != null)에서는 기본적으로 도착 정보 그룹만 보여주지만,
  // 시간표 전용 노선(is_realtime=false)은 그 정류장에 실시간 도착 데이터가 없어
  // 도착 그룹이 비고 시간표 그룹마저 숨기면 화면이 통째로 빈다(예: 시화터미널의 3400).
  // 따라서 실시간이 아닌 노선이면 GBIS 정류장에서도 출발 시간표를 보여준다.
  const showTimetableSection = showTimetableGroup || !isRealtime

  // 이전 도착 기록 (history-preview → ArrivalHistory 어댑터) — 실시간 노선에서만 의미 있음
  const { data: histData, loading: histLoading } = useBusHistoryPreview(routeNumber)

  const nowMin = useMemo(() => nowMinutes(), [])

  // 즐겨찾기
  const favKey = routeNumber ? `bus:${routeNumber}` : null
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)

  // 정류장 칩 목록
  const stops = ttData?.stops ?? []

  // 현재 탭의 시간표 목록
  const schedule = useMemo(() => {
    if (!ttData?.timetable) return []
    return ttData.timetable[dayTab] ?? []
  }, [ttData, dayTab])

  // 다음 차 인덱스
  const nextIdx = useMemo(() => {
    if (!schedule.length) return -1
    return schedule.findIndex((e) => timeToMinutes(e.depart_at) >= nowMin)
  }, [schedule, nowMin])

  // 시간표 전용 노선(is_realtime=false)은 시각 전체가 한 화면에 안 들어와
  // 새벽 첫차부터 보여주면 다음 차를 찾기 어렵다. 진입 시 다음 차 직전 2개가
  // 보이는 위치를 시작점으로 자동 스크롤한다. (실시간 노선은 도착 카드를 가리지
  // 않도록 적용하지 않는다.)
  const scrollRef = useRef(null)
  const anchorRowRef = useRef(null)
  const anchorIdx = nextIdx < 0 ? -1 : Math.max(0, nextIdx - 2)
  useEffect(() => {
    if (isRealtime) return
    if (anchorIdx <= 0) return // 다음 차가 앞쪽이면 그대로 맨 위에서 시작
    const c = scrollRef.current
    const t = anchorRowRef.current
    if (!c || !t) return
    const top = t.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop
    c.scrollTop = Math.max(0, top)
  }, [isRealtime, anchorIdx, dayTab, resolvedCategory, ttData])

  // 실시간 라이브 데이터 — histData에서 가장 가까운 arrivals[0] (is_realtime=true일 때만)
  const liveEntry = useMemo(() => {
    if (!isRealtime) return null
    if (!histData?.arrivals?.length) return null
    return histData.arrivals[0]
  }, [isRealtime, histData])

  // 이전 도착 기록 rows — histData 어댑터 변환 (is_realtime=true일 때만)
  // now를 렌더 시점에 계산해 toHistoryRows에 주입 (현재 시각대 매칭 보장)
  const historyRows = useMemo(() => {
    if (!isRealtime) return []
    return toHistoryRows(histData, new Date())
  }, [isRealtime, histData])

  // 이전 도착 기록 헤더 라벨 (history-preview columns의 day_label 사용)
  const historyColumnLabels = useMemo(() => {
    const cols = histData?.columns
    if (!Array.isArray(cols) || cols.length === 0) return null
    return {
      yesterday: cols[0]?.day_label ?? cols[0]?.label ?? '어제',
      dayBefore: cols[1]?.day_label ?? cols[1]?.label ?? '이틀 전',
      lastWeek: cols[2]?.day_label ?? cols[2]?.label ?? '7일 전',
    }
  }, [histData])

  // 노선 표시명
  const routeDisplayName = ttData?.route_no ?? routeNumber ?? ''
  // 행선지
  const headLabel = ttData?.direction_name ?? ttData?.head_label ?? ttData?.direction ?? null
  const subLabel = ttData?.path_label ?? null
  // 기점 출발 정류장명
  const originStopName = ttData?.origin_stop_name ?? null

  // 통계
  const totalTrips = ttData?.total_trips ?? null
  const intervalLabel = ttData?.interval_label ?? null
  const firstBus = ttData?.first_bus ?? null
  const lastBus = ttData?.last_bus ?? null

  function handleBack() {
    window.history.back()
  }

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg">
      {/* ── 헤더 ── */}
      <header className="flex-none flex items-center gap-[11px] px-4 pt-[18px] pb-[13px] bg-surface dark:bg-surface border-b border-line dark:border-line">
        <button
          type="button"
          aria-label="뒤로"
          onClick={handleBack}
          className="w-[42px] h-[42px] rounded-card flex-none flex items-center justify-center bg-surface-2 dark:bg-bg border border-line dark:border-line text-ink-2 dark:text-ink-2-dark"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex-1 min-w-0 flex items-center gap-[9px]">
          <RouteBadge route={routeDisplayName} />
          <div className="min-w-0">
            {headLabel && (
              <span className="block text-[16px] font-semibold text-ink dark:text-ink tracking-[-0.02em] truncate">
                {headLabel}
              </span>
            )}
            {stop ? (
              <span className="block text-[11.5px] font-semibold text-mute dark:text-mute mt-px truncate">
                {stop} 기준
              </span>
            ) : originStopName ? (
              <span className="block text-[11.5px] font-semibold text-mute dark:text-mute mt-px truncate">
                {originStopName} 출발
              </span>
            ) : subLabel ? (
              <span className="block text-[11.5px] font-semibold text-mute dark:text-mute mt-px">
                {subLabel}
              </span>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          onClick={() => toggleFav({ type: 'bus', label: routeNumber })}
          className="w-[42px] h-[42px] rounded-card flex-none flex items-center justify-center bg-surface-2 dark:bg-bg border border-line dark:border-line"
        >
          <Star
            size={19}
            fill={isFavorite ? 'currentColor' : 'none'}
            className={isFavorite ? 'text-imminent' : 'text-mute dark:text-mute'}
          />
        </button>
      </header>

      {/* ── 바디 ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 정류장 칩 & 탭 (고정 영역) */}
        <div className="flex-none px-4 pt-3 pb-0">
          {stops.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3">
              <span className="text-[11.5px] font-semibold tracking-[.04em] text-mute flex-none mr-0.5">
                정류장
              </span>
              {stops.map((stop) => {
                const isActive = (activeStop ?? stops[0]?.id) === stop.id
                return (
                  <button
                    key={stop.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveStop(stop.id)}
                    className={[
                      'flex-none inline-flex items-center px-[13px] py-[7px] rounded-pill',
                      'text-[13px] font-semibold whitespace-nowrap transition-colors',
                      isActive
                        ? 'bg-accent-bg border border-accent/25 dark:border-accent/35 text-accent-ink dark:text-accent font-semibold'
                        : 'bg-surface dark:bg-surface border border-line dark:border-line text-ink-2 dark:text-ink-2-dark',
                    ].join(' ')}
                  >
                    {stop.name}
                  </button>
                )
              })}
            </div>
          )}

          {/* 방향 탭 (등교/하교) */}
          <DirectionTabs
            categories={availableCategories}
            active={resolvedCategory}
            onChange={(cat) => setActiveCategory(cat)}
          />

          {/* 평일/토/일 세그먼트 */}
          <div
            role="tablist"
            className="flex gap-[5px] bg-surface-2 dark:bg-bg border border-line dark:border-line rounded-card p-1"
          >
            {DAY_TABS.map((tab) => {
              const isActive = tab.id === dayTab
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setDayTab(tab.id)}
                  className={[
                    'flex-1 flex items-center justify-center min-h-[40px] rounded-button',
                    'text-[14px] font-semibold select-none transition-all',
                    isActive
                      ? 'bg-ink dark:bg-accent text-white dark:text-black font-semibold shadow-[0_4px_10px_color-mix(in_srgb,var(--tj-ink)_22%,transparent)]'
                      : 'text-mute dark:text-mute',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 스크롤 영역: 시간표 리스트 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 pt-3 pb-6">
            {ttLoading && (
              <div className="mt-8">
                <EmptyState title="불러오는 중..." />
              </div>
            )}

            {ttError && !ttLoading && (
              <div className="mt-8">
                <EmptyState title="시간표를 불러올 수 없어요" desc="잠시 후 다시 시도해 주세요" />
              </div>
            )}

            {!ttLoading && !ttError && schedule.length === 0 && (
              <div className="mt-8">
                <EmptyState title="운행 정보 없음" desc="해당 요일 운행 정보가 없어요" />
              </div>
            )}

            {!ttLoading && !ttError && schedule.length > 0 && (
              <>
                {/* ── 그룹 A: 내 정류장 도착 정보
                    표시 조건: (stop 없음 && is_realtime) 또는 (stop이 GBIS 실시간 정류장)
                ── */}
                {isRealtime && showArrivalGroup && (
                  <section aria-label="내 정류장 도착 정보">
                    {/* 그룹 A 헤더 */}
                    <div className="mb-2">
                      <h2 className="text-[13.5px] font-semibold text-ink dark:text-ink tracking-[-0.01em]">
                        {histData?.stop_name
                          ? `${histData.stop_name} 도착 정보`
                          : '내 정류장 도착 정보'}
                      </h2>
                      <p className="text-[12px] font-semibold text-mute dark:text-mute mt-0.5">
                        이 정류장에 버스가 도착하는 시각이에요
                      </p>
                    </div>

                    {/* 실시간 도착 카드 */}
                    <RealtimeArrivalCard
                      histData={histData}
                      histLoading={histLoading}
                      stopName={histData?.stop_name}
                    />

                    {/* 이전 도착 기록 */}
                    <div className="mt-4">
                      <h3 className="text-[12.5px] font-semibold text-ink-2 dark:text-ink-2-dark tracking-[-0.01em] mb-2">
                        {histData?.stop_name
                          ? `${histData.stop_name} 도착 기록`
                          : '이전 도착 기록'}
                      </h3>
                      {histLoading ? (
                        <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-4 text-[13px] font-semibold text-mute text-center">
                          기록 불러오는 중...
                        </div>
                      ) : (
                        <ArrivalHistory
                          rows={historyRows}
                          routeNumber={routeNumber}
                          columnLabels={historyColumnLabels}
                        />
                      )}
                    </div>
                  </section>
                )}

                {/* ── 그룹 구분선 (is_realtime=true이고 두 그룹 모두 표시할 때만) ── */}
                {isRealtime && showArrivalGroup && showTimetableSection && (
                  <div className="my-6 border-t border-line dark:border-line" />
                )}

                {/* ── 그룹 B: 기점 출발 시간표
                    표시 조건: (stop 없음) 또는 (stop이 시간표 전용 정류장)
                              또는 (시간표 전용 노선 — GBIS 정류장이어도 표시)
                ── */}
                {showTimetableSection && (
                <section aria-label="기점 출발 시간표">
                  {/* 그룹 B 헤더 */}
                  <div className="mb-2">
                    <h2 className="text-[13.5px] font-semibold text-ink dark:text-ink tracking-[-0.01em]">
                      {originStopName
                        ? `${originStopName} 출발 시간표`
                        : '출발 시간표'}
                      {headLabel && (
                        <span className="font-semibold text-mute dark:text-mute"> · {headLabel}</span>
                      )}
                    </h2>
                    <p className="text-[12px] font-semibold text-mute dark:text-mute mt-0.5">
                      {isRealtime
                        ? '기점에서 출발하는 정해진 시각이에요. 도착 시각과 달라요.'
                        : '기점에서 출발하는 시각이에요.'}
                    </p>
                  </div>

                  {/* 시간표 리스트 */}
                  <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-sheet overflow-hidden">
                    {schedule.map((entry, idx) => {
                      const isNextSlot = idx === nextIdx
                      return (
                        <div
                          key={`${entry.depart_at}-${idx}`}
                          ref={idx === anchorIdx ? anchorRowRef : undefined}
                        >
                          {/* 실시간 노선에서만: 다음 차 직전에 인라인 라이브 행 삽입 */}
                          {isRealtime && isNextSlot && liveEntry && (
                            <InlineLiveRow liveData={liveEntry} />
                          )}
                          <TimetableRow entry={entry} nowMin={nowMin} isNext={isNextSlot} />
                        </div>
                      )
                    })}

                    {/* 푸터: 통계 */}
                    {(firstBus || lastBus || intervalLabel || totalTrips) && (
                      <div className="px-4 py-[10px] text-center text-[12.5px] font-semibold text-mute border-t border-line dark:border-line">
                        {totalTrips && (
                          <span>
                            {DAY_TABS.find((t) => t.id === dayTab)?.label} 총{' '}
                            <strong className="text-ink font-semibold">{totalTrips}회</strong>
                            {intervalLabel && (
                              <> · 배차 <strong className="text-ink font-semibold">{intervalLabel}</strong></>
                            )}
                            {lastBus && (
                              <> · 막차 <strong className="text-ink font-semibold">{lastBus}</strong></>
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </section>
                )}

                {/* ── 그룹 C: 노선 혼잡도 (실시간 추적 노선에서만 GBIS 혼잡도 로그가 쌓임) ── */}
                {isRealtime && (
                  <>
                    <div className="my-6 border-t border-line dark:border-line" />
                    <RouteCrowdingSection routeNumber={routeNumber} />
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
