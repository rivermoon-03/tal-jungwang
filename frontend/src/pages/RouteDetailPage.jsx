import { useState, useMemo, useEffect, useRef } from 'react'
import { Star, ChevronLeft, ChevronRight, Bus, Repeat } from 'lucide-react'
import { useBusTimetableByRoute, useBusHistoryPreview, useBusRoutes, useBusArrivalStats } from '../hooks/useBus'
import useFavorites from '../hooks/useFavorites'
import RouteBadge from '../components/ui/RouteBadge'
import StatusChip from '../components/ui/StatusChip'
import EmptyState from '../components/ui/EmptyState'
import ArrivalHistory from '../components/bus/ArrivalHistory'
import BusStatsHeader from '../components/bus/BusStatsHeader'
import RouteCrowdingSection from '../components/stats/RouteCrowdingSection'
import { toHistoryRows } from '../utils/historyAdapter'
import { getGbisStationId, getGbisStationIdForRoute } from '../components/dashboard/busStationConfig'

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
// sunday 라벨은 '일/공휴일' — 실제 DB 조회 결과 모든 노선에서 saturday/sunday
// 시간표가 시각까지 완전히 동일하고(app/core/calendar.py가 공휴일도 'sunday'로
// 매핑), 이 탭이 실질적으로 "주말/공휴일 시간표"를 의미하기 때문.
const DAY_TABS = [
  { id: 'weekday',  label: '평일' },
  { id: 'saturday', label: '토요일' },
  { id: 'sunday',   label: '일/공휴일' },
]

// 3개 pill 대신 눌러서 평일→토요일→일/공휴일 순으로 순환하는 버튼 하나로 대체.
function nextDayTab(current) {
  const idx = DAY_TABS.findIndex((t) => t.id === current)
  return DAY_TABS[(idx + 1) % DAY_TABS.length].id
}

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
function RealtimeArrivalCard({ histData, histLoading, onHistory }) {
  const realtimeEta = histData?.realtime_eta ?? null

  // 과거 도착 기록 진입 화살표 — 도착 카드 우측에 작게. 별도 탭이 아니라 이 › 로 들어간다.
  const historyArrow = onHistory ? (
    <button
      type="button"
      onClick={onHistory}
      aria-label="과거 도착 기록 보기"
      className="flex-none self-stretch flex flex-col items-center justify-center gap-0.5 pl-3 pr-1 border-l border-accent/20 dark:border-accent/25 text-accent-ink dark:text-accent pressable"
    >
      <ChevronRight size={20} strokeWidth={2.4} />
      <span className="text-[9px] font-bold leading-none">도착 기록</span>
    </button>
  ) : null

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
          {historyArrow}
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
      <span className="flex-1 text-[14px] font-semibold text-mute dark:text-mute">
        실시간 도착 정보가 없어요
      </span>
      {historyArrow}
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

  // 이전 도착 기록 (history-preview → ArrivalHistory 어댑터) — 실시간 노선에서만 의미 있음.
  // 카드와 동일하게 방향별 GBIS 추적 정류장을 넘겨, 선택한 방향(등교/하교)의 실시간 도착을 본다.
  // 미전달 시 백엔드가 history 빈도 기반 정류장으로 폴백해 방향이 어긋날 수 있다.
  const histStopId = getGbisStationIdForRoute(routeNumber, resolvedCategory ?? undefined)
  const { data: histData, loading: histLoading } = useBusHistoryPreview(routeNumber, histStopId)

  const nowMin = useMemo(() => nowMinutes(), [])

  // 즐겨찾기
  const favKey = routeNumber ? `bus:${routeNumber}` : null
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)

  // 정류장 칩 목록
  const stops = ttData?.stops ?? []

  // 현재 탭(dayTab)의 시간표 목록 — 요일 전환에 따라 바뀐다.
  const schedule = useMemo(() => {
    if (!ttData?.timetable) return []
    return ttData.timetable[dayTab] ?? []
  }, [ttData, dayTab])

  // 이 방향이 "어느 요일이든" 출발 시간표를 갖는지 — dayTab(현재 선택된 요일)과 무관하게
  // 판정한다. schedule.length(오늘 선택된 요일만)로 판정하면, 예를 들어 일요일에
  // 운행하지 않는 노선에서 사용자가 요일 전환으로 일요일을 선택하는 순간 이 방향
  // 자체가 "시간표 없음"으로 오판되어 섹션(및 그 안의 요일 전환 버튼)이 통째로
  // 사라지는 버그가 있었다(사용자가 되돌아갈 방법이 없어짐).
  const timetableHasAnyDay = useMemo(() => {
    const t = ttData?.timetable
    if (!t) return false
    return Object.values(t).some((arr) => Array.isArray(arr) && arr.length > 0)
  }, [ttData])

  // 실시간 도착 그룹과 시간표 그룹을 독립적으로 판정한다.
  // 시흥33 등교처럼 "실시간은 있지만 정해진 시간표가 없는" 방향이 있어서,
  // 시간표 유무로 화면 전체를 가리면 실시간 도착이 통째로 숨는 버그가 있었다.
  const hasRealtimeGroup = isRealtime && showArrivalGroup
  const hasTimetableCapability = showTimetableSection && timetableHasAnyDay
  // 실시간 도착 + 출발 시간표가 둘 다 있으면 장소 중심 탭으로 분리한다.
  const bothGroups = hasRealtimeGroup && hasTimetableCapability

  // 장소 중심 탭 상태 — [{도착 정류장} 도착 | {기점} 출발]. 과거 도착 기록은 별도 탭이
  // 아니라 도착 카드 우측 › 화살표로 진입(showHistory). 방향/노선 바뀌면 초기화.
  const [placeTab, setPlaceTab] = useState('arrive')
  const [showHistory, setShowHistory] = useState(false)
  useEffect(() => { setPlaceTab('arrive'); setShowHistory(false) }, [resolvedCategory, routeNumber])

  // 출발 시간표 콘텐츠가 화면에 보이는 중인지 — 요일 전환 버튼 노출 조건과 동일하게 재사용.
  const showDepartContent = (bothGroups && placeTab === 'depart') || (!bothGroups && hasTimetableCapability)

  // 과거 기록 통계 — 평소 배차 간격 + 도착 분포(p10/p50/p90) + 표본수(1주+ 데이터 판정).
  // histData의 route_id/stop_id(카드와 동일 GBIS 정류장) 기준으로 조회.
  const { data: statsRes } = useBusArrivalStats(histData?.route_id ?? null, histData?.stop_id ?? null)
  const arrivalStats = statsRes?.stats ?? null
  const statsDayLabel = statsRes
    ? ({ weekday: '평일', saturday: '토요일', sunday: '일/공휴일' }[statsRes.day_type] ?? null)
    : null
  const statsHourLabel = statsRes?.hour_of_day != null ? `${statsRes.hour_of_day}시` : null

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

          {/* 방향 탭 (등교/하교) — 풀사이즈 유지 */}
          <DirectionTabs
            categories={availableCategories}
            active={resolvedCategory}
            onChange={(cat) => setActiveCategory(cat)}
          />

          {/* 요일 전환 — 고정(스크롤 안 되는) 헤더 영역에 둬서 시간표를 스크롤한 채로도
              항상 탭 가능하게 한다. pill 3개 대신 눌러서 평일→토요일→일/공휴일로
              순환하는 버튼 하나로 압축(공간 절약). 출발 시간표가 보이는 중일 때만 노출. */}
          {showDepartContent && (
            <div className="flex justify-end mt-2 -mb-1">
              <button
                type="button"
                onClick={() => setDayTab((d) => nextDayTab(d))}
                aria-label={`요일 전환, 현재 ${DAY_TABS.find((t) => t.id === dayTab)?.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line dark:border-line bg-surface-2 dark:bg-bg px-2.5 py-1 text-[11.5px] font-bold text-ink-2 dark:text-ink-2-dark pressable"
              >
                <Repeat size={11} strokeWidth={2.4} />
                {DAY_TABS.find((t) => t.id === dayTab)?.label}
              </button>
            </div>
          )}
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

            {!ttLoading && !ttError && !hasRealtimeGroup && !hasTimetableCapability && (
              <div className="mt-8">
                <EmptyState title="운행 정보 없음" desc="해당 요일 운행 정보가 없어요" />
              </div>
            )}

            {!ttLoading && !ttError && (hasRealtimeGroup || hasTimetableCapability) && (
              <>
                {/* ── 장소 중심 탭: [{도착 정류장} 도착 | {기점} 출발] — 실시간+시간표 둘 다 있을 때만.
                    등교/하교(DirectionTabs, 풀사이즈 세그먼트)보다 한 단계 가벼운 작은 pill로 둬
                    두 선택지가 같은 무게로 쌓이지 않게 한다. 기록뷰(showHistory)에서는 숨겨 집중. ── */}
                {bothGroups && !showHistory && (
                  <div
                    role="tablist"
                    aria-label="정류장 선택"
                    className="flex items-center gap-1.5 mb-3"
                  >
                    {[
                      { id: 'arrive', label: `${histData?.stop_name ?? '내 정류장'} 도착` },
                      { id: 'depart', label: `${originStopName ?? '기점'} 출발` },
                    ].map((t) => {
                      const active = placeTab === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setPlaceTab(t.id)}
                          className={[
                            'inline-flex items-center h-[30px] max-w-[180px] px-3 rounded-full',
                            'text-[12px] font-bold select-none transition-colors truncate',
                            active
                              ? 'bg-accent-bg text-accent-ink dark:bg-accent/20 dark:text-accent'
                              : 'bg-surface-2 dark:bg-bg text-mute dark:text-mute border border-line dark:border-line',
                          ].join(' ')}
                        >
                          <span className="truncate">{t.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* ── 도착 탭 (또는 단일 도착 그룹) ── */}
                {((bothGroups && placeTab === 'arrive') || (!bothGroups && hasRealtimeGroup)) && (
                  showHistory ? (
                    <section aria-label="과거 도착 기록">
                      <button
                        type="button"
                        onClick={() => setShowHistory(false)}
                        className="flex items-center gap-1 mb-3 text-[13px] font-bold text-ink dark:text-ink pressable"
                      >
                        <ChevronLeft size={16} />
                        {histData?.stop_name ? `${histData.stop_name} 도착 기록` : '도착 기록'}
                      </button>
                      {/* 1주+ 데이터가 있으면 평소 배차 간격 + 도착 분포(p10/p50/p90) 요약(BusStatsHeader).
                          표본이 적으면 내부에서 '데이터 부족' 칩을 띄운다. */}
                      <BusStatsHeader stats={arrivalStats} dayLabel={statsDayLabel} hourLabel={statsHourLabel} />
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
                      <p className="mt-3 text-[11.5px] font-semibold text-mute dark:text-mute text-center">
                        과거 도착 시각을 참고해 직접 가늠해보세요
                      </p>
                    </section>
                  ) : (
                    <section aria-label="내 정류장 도착 정보">
                      <RealtimeArrivalCard
                        histData={histData}
                        histLoading={histLoading}
                        onHistory={() => setShowHistory(true)}
                      />
                      <p className="mt-2 text-[11.5px] font-semibold text-mute dark:text-mute">
                        오른쪽 <b className="text-accent-ink dark:text-accent">›</b> 를 누르면 과거 도착 기록·평소 배차를 볼 수 있어요
                      </p>
                    </section>
                  )
                )}

                {/* ── 출발 탭 (또는 단일 시간표 그룹) ── */}
                {showDepartContent && (
                <section aria-label="기점 출발 시간표">
                  {/* 그룹 B 헤더 — 요일 전환 버튼은 고정 헤더 영역(DirectionTabs 아래)으로
                      옮겨졌다. 이 섹션은 스크롤 영역 안이라 여기 두면 스크롤할 때마다
                      다시 위로 올라와야 하는 문제가 있었다. */}
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

                  {/* 시간표 리스트 — 이 방향은 다른 요일엔 시간표가 있지만 지금 선택한
                      요일(dayTab)엔 없는 경우(예: 일요일 미운행)를 위한 안내. 요일 전환
                      버튼은 고정 헤더에 있어 이 상태에서도 계속 눌러 다른 요일로 바꿀 수 있다. */}
                  {schedule.length === 0 ? (
                    <div className="rounded-sheet border border-line dark:border-line px-4 py-6 text-center">
                      <p className="text-[13px] font-semibold text-mute dark:text-mute">
                        {DAY_TABS.find((t) => t.id === dayTab)?.label}엔 정해진 출발 시각이 없어요
                      </p>
                    </div>
                  ) : (
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
                  )}
                </section>
                )}

                {/* 실시간 노선인데 이 방향은 정해진 출발 시간표가 "어느 요일이든" 없을 때
                    안내 (예: 시흥33 등교). timetableHasAnyDay로 판정 — 요일 전환으로
                    오늘만 비어 보이는 경우와 구분한다. 단일 도착 그룹(탭 없음)에서만. */}
                {!bothGroups && hasRealtimeGroup && showTimetableSection && !timetableHasAnyDay && !showHistory && (
                  <p className="mt-2 text-[12.5px] font-semibold text-mute dark:text-mute leading-relaxed">
                    이 방향은 정해진 출발 시간표가 없는 실시간 운행 노선이에요.
                  </p>
                )}

                {/* ── 그룹 C: 노선 혼잡도 (실시간 추적 노선에서만). 기록뷰에서는 숨겨 집중. ── */}
                {isRealtime && !showHistory && (
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
