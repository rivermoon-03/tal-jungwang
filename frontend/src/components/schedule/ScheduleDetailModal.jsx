/**
 * ScheduleDetailModal — bottom-sheet modal with full upcoming schedule.
 * - 세로 리스트 + "다음" 배지 + "N분 뒤"
 * - 드래그 손잡이로 스와이프 다운 닫기
 * - FloatingDock 위로 띄워지도록 bottom padding 확보
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Clock, Star, MapPin } from 'lucide-react'
import { useBusTimetable, useBusTimetableByRoute, useBusHistoryPreview } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayTimetable } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'
import { RouteProgressStrip } from '../bus/BusArrivalCard'
import { ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'

// ─── helpers ────────────────────────────────────────────────────────────

function toHHMM(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function minutesUntil(hhmm, now = new Date()) {
  const [h, m] = (hhmm ?? '00:00').split(':').map(Number)
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 60000)
}

function fmtDelta(mins) {
  if (mins <= 0) return '곧 출발'
  if (mins < 60) return `${mins}분 뒤`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}시간 뒤` : `${h}시간 ${m}분 뒤`
}

function scheduleTypeLabel(type) {
  return type === 'weekday' ? '평일' : type === 'saturday' ? '토요일' : '일/공휴일'
}

// ─── shared list row ────────────────────────────────────────────────────

function TimeRow({ time, isNext, isLast, destination, note, accentColor, rowRef }) {
  const isHHMM = typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)
  const mins = isHHMM ? minutesUntil(time) : null
  return (
    <div
      ref={rowRef}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-mini transition-colors ${
        isNext
          ? 'bg-accent/8 dark:bg-accent-dark/12'
          : ''
      }`}
    >
      {isNext && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] bg-accent dark:bg-accent-dark rounded-full" />
      )}
      <span
        className={`${
          isHHMM
            ? (isNext ? 'text-eta-mob font-black tabular-nums tracking-tight flex-shrink-0 pl-1.5' : 'text-eta-mob font-bold tabular-nums tracking-tight flex-shrink-0')
            : 'text-sm font-bold leading-snug break-keep min-w-0'
        } ${isNext ? 'text-accent dark:text-accent-dark' : 'text-ink dark:text-ink-dark'}`}
      >
        {time}
      </span>
      {(destination || note) && (
        <span className="text-meta font-medium text-mute dark:text-mute-dark truncate">
          {destination || note}
        </span>
      )}
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        {isNext && (
          <span className="text-micro font-extrabold px-2.5 py-0.5 rounded-full bg-accent dark:bg-accent-dark text-white dark:text-ink tracking-wide">
            다음
          </span>
        )}
        {isLast && (
          <span className="text-micro font-bold px-2 py-0.5 rounded-full bg-ink dark:bg-mute-2 text-white dark:text-ink">
            막차
          </span>
        )}
        {mins != null && (
          <span
            className={`text-meta font-extrabold tabular-nums tracking-tight ${
              isNext ? 'text-accent dark:text-accent-dark' : 'text-mute dark:text-mute-dark'
            }`}
          >
            {fmtDelta(mins)}
          </span>
        )}
      </div>
    </div>
  )
}

function PastRow({ time }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 opacity-50">
      <span className="text-meta font-semibold text-mute dark:text-mute-dark tabular-nums">{time}</span>
      <span className="text-[11px] font-medium text-mute-2 dark:text-mute-2-dark ml-auto">지난 시각</span>
    </div>
  )
}

function TimeGrid({ times }) {
  if (!times.length) return null
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {times.map((t, i) => (
        <div
          key={`${t}-${i}`}
          className="text-center py-2 px-1 rounded-mini bg-surface-alt dark:bg-surface-dark-alt text-sm font-bold text-text dark:text-text-dark tabular-nums"
        >
          {t}
        </div>
      ))}
    </div>
  )
}

// ─── per-type content ───────────────────────────────────────────────────

function BusContent({ routeCode, routeId = null, stopId = null, accentColor }) {
  // routeId가 있으면 방향 정확한 /bus/timetable/{route_id} 사용 (등교/하교 분리 route에 필수)
  const byId    = useBusTimetable(routeId)
  const byRoute = useBusTimetableByRoute(routeId == null ? routeCode : null, stopId != null ? { stopId } : undefined)
  const { data, loading, error } = routeId != null ? byId : byRoute
  const nextRef = useRef(null)
  const now = new Date()
  const nowStr = toHHMM(now)
  const allTimes = data?.times ?? []
  // Date 기반 비교: 자정 이후 00:xx 시간대를 문자열 비교가 미래로 잘못 잡는 버그 방지
  // 12h 필터 없음 — 상세 모달은 당일 시간표 전체를 표시하므로 단순 미래 여부만 판단
  const firstFutureIdx = allTimes.findIndex((t) => {
    const [h, m] = (t ?? '').split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return false
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d > now
  })
  const futureCount = firstFutureIdx === -1 ? 0 : allTimes.length - firstFutureIdx

  useEffect(() => {
    if (nextRef.current) {
      nextRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [data])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!allTimes.length) return <EmptyMsg text="오늘 운행 정보가 없어요" />

  return (
    <div className="flex flex-col gap-2">
      {data?.schedule_type && (
        <p className="text-xs text-slate-400 mb-1">
          {scheduleTypeLabel(data.schedule_type)} 시간표 · 첫차 {allTimes[0]} ~ 막차 {allTimes[allTimes.length - 1]} · 총 {allTimes.length}회 · 남은 {futureCount}회
        </p>
      )}
      {allTimes.map((t, i) => {
        const [th, tm] = (t ?? '').split(':').map(Number)
        const td = new Date(now)
        if (!Number.isNaN(th) && !Number.isNaN(tm)) td.setHours(th, tm, 0, 0)
        const isPast = td <= now
        if (isPast) return <PastRow key={`p-${t}-${i}`} time={t} />
        const isNext = i === firstFutureIdx
        const isLast = i === allTimes.length - 1
        return <TimeRow key={`f-${t}-${i}`} time={t} isNext={isNext} isLast={isLast} accentColor={accentColor} rowRef={isNext ? nextRef : undefined} />
      })}
    </div>
  )
}

// subwayKey → { dataKey, label }
const SUBWAY_KEY_META = {
  up:         { dataKey: 'up',         label: '상행 (왕십리 방면)' },
  down:       { dataKey: 'down',       label: '하행 (인천 방면)' },
  line4_up:   { dataKey: 'line4_up',   label: '상행' },
  line4_down: { dataKey: 'line4_down', label: '하행' },
  choji_up:   { dataKey: 'choji_up',   label: '상행 (소사 방면)' },
  choji_dn:   { dataKey: 'choji_dn',   label: '하행 (원시 방면)' },
  siheung_up: { dataKey: 'siheung_up', label: '상행 (소사 방면)' },
  siheung_dn: { dataKey: 'siheung_dn', label: '하행 (원시 방면)' },
}

function SubwayContent({ accentColor, subwayKey }) {
  const { data, loading, error } = useSubwayTimetable()
  const now = new Date()
  const nowStr = toHHMM(now)

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!data) return <EmptyMsg text="시간표 정보가 없어요" />

  // 단일 방향 모드 (카드에서 특정 방향 클릭)
  if (subwayKey && SUBWAY_KEY_META[subwayKey]) {
    const { dataKey, label } = SUBWAY_KEY_META[subwayKey]
    const list = data[dataKey] ?? []
    const items = list.filter((t) => (t.depart_at ?? '') >= nowStr)
    return (
      <DirectionBlock
        label={label}
        allItems={list}
        items={items}
        accentColor={accentColor}
      />
    )
  }

  // 폴백: 양방향 (레거시)
  const upList = data.up ?? []
  const downList = data.down ?? []
  const upItems = upList.filter((t) => (t.depart_at ?? '') >= nowStr)
  const downItems = downList.filter((t) => (t.depart_at ?? '') >= nowStr)

  return (
    <div className="flex flex-col gap-5">
      <DirectionBlock
        label="상행 (왕십리 방면)"
        allItems={upList}
        items={upItems}
        accentColor={accentColor}
      />
      <DirectionBlock
        label="하행 (인천 방면)"
        allItems={downList}
        items={downItems}
        accentColor={accentColor}
      />
    </div>
  )
}

function DirectionBlock({ label, allItems = [], items, accentColor }) {
  const nextRef = useRef(null)
  const allDone = items.length === 0
  useEffect(() => {
    if (nextRef.current) {
      nextRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [items.length])
  return (
    <div>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
        {label} · 오늘 총 {allItems.length}편 중 {items.length}편 남음
      </p>
      {allDone && allItems.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            금일 운행 종료
          </span>
        </div>
      )}
      {allDone ? (
        <TimeGrid times={allItems.map((t) => t.depart_at)} />
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((t, i) => (
            <TimeRow
              key={`${t.depart_at}-${i}`}
              time={t.depart_at}
              destination={t.destination}
              isNext={i === 0}
              isLast={i === items.length - 1}
              accentColor={accentColor}
              rowRef={i === 0 ? nextRef : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 셔틀이 주말·공휴일에 빈 응답이면 다음 평일(월~금) 시간표를 폴백으로 보여줌.
function isWeekend(d = new Date()) {
  const day = d.getDay()
  return day === 0 || day === 6
}

function nextWeekdayDateStr() {
  const d = new Date()
  const day = d.getDay()
  const offset = day === 0 ? 1 : day === 6 ? 2 : 0
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ShuttleContent({ direction, accentColor }) {
  // 등교 회차편의 하교 출발 시각 판정을 위해 양 방향을 한 번에 조회.
  // (direction 쿼리를 생략하면 백엔드가 양 방향을 함께 반환 — 로딩 경합 제거)
  const today = useShuttleSchedule()
  // 주말이면 다음 평일 시간표를 폴백으로 fetch.
  const weekend = isWeekend()
  const fallbackDate = weekend ? nextWeekdayDateStr() : null
  const fallback = useShuttleSchedule(undefined, fallbackDate, { enabled: weekend })

  // 요청한 direction에 시간 데이터가 있는지로 todayEmpty 판정.
  // (백엔드 응답의 directions 배열에는 다른 방향 데이터가 있을 수 있어서
  //  단순 length 체크로는 본캠 0번이 비었는데도 2캠 2번 데이터 때문에 폴백이 안 켜졌음.)
  const findDirTimes = (apiData) => apiData?.directions?.find((d) => d.direction === direction)?.times ?? []
  const todayEmpty = !today.loading && (today.error || findDirTimes(today.data).length === 0)
  const fallbackHasData = findDirTimes(fallback.data).length > 0
  const usingFallback = weekend && todayEmpty && fallbackHasData

  const data = usingFallback ? fallback.data : today.data
  // 폴백 fetch가 끝나기 전엔 EmptyMsg가 잠깐 깜빡일 수 있으므로,
  // 주말이면 fallback.loading도 함께 봐서 둘 다 끝나야 EmptyMsg를 보여준다.
  const loading = today.loading || (weekend && fallback.loading)
  const error = today.error && (!weekend || fallback.error)

  const nextRef = useRef(null)
  const now = new Date()
  // 폴백 모드: 평일 시간표 전체를 보여주기 위해 모든 시각을 "미래"로 취급.
  const nowStr = usingFallback ? '00:00' : toHHMM(now)
  const dirData = data?.directions?.find((d) => d.direction === direction)
  const times = dirData?.times ?? []

  // 하교의 수시운행 밴드를 [start, end) 구간 리스트로 산출.
  // 등교 회차편의 하교 출발 시각이 이 구간에 속하면 "수시운행 중" 으로 분기한다.
  const outboundFrequentBands = (() => {
    const outboundTimes = data?.directions?.find((d) => d.direction === 1)?.times ?? []
    const normalized = outboundTimes.map((t) => ({
      ts: (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5),
      note: typeof t === 'object' ? t?.note ?? null : null,
    })).filter((e) => e.ts)
    const bands = []
    let i = 0
    while (i < normalized.length) {
      if (normalized[i].note !== '수시운행') { i++; continue }
      const start = normalized[i].ts
      let j = i + 1
      while (j < normalized.length && normalized[j].note === '수시운행') j++
      const end = normalized[j]?.ts ?? null
      bands.push({ start, end })
      i = j
    }
    return bands
  })()

  const originTimeInFrequentBand = (originTime) => {
    if (!originTime) return false
    return outboundFrequentBands.some((b) =>
      originTime >= b.start && (b.end == null || originTime < b.end)
    )
  }

  const future = []
  const past = []
  for (const t of times) {
    const timeStr = (typeof t === 'string' ? t : t?.depart_at ?? '').slice(0, 5)
    const note = typeof t === 'object' ? t?.note : null
    if (timeStr >= nowStr) future.push({ time: timeStr, note })
    else past.push({ time: timeStr, note })
  }

  // 마지막 과거 항목이 "회차편 · 학교 수시운행 출발"이면
  // 수시운행 버스들이 아직 회차 중인 구간 → 다음 회차편도 "수시운행 중"으로 표기
  const lastPast = past[past.length - 1] ?? null
  const inFrequentReturnWindow = !!(
    lastPast?.note?.startsWith('회차편') &&
    lastPast.note.includes('수시운행')
  )

  // 연속된 수시운행 항목을 하나의 밴드로 묶음.
  // 회차편 중 하교 원천이 '수시운행'인 경우(note: "회차편 · 학교 수시운행 출발")는
  // 하교 출발 시각이 정해지지 않았으므로 등교의 구체 시각을 숨기고 상태 라벨만 표시한다.
  const displayEntries = []
  {
    let i = 0
    while (i < future.length) {
      const e = future[i]
      if (e.note === '수시운행') {
        let j = i
        while (j < future.length && future[j].note === '수시운행') j++
        // 밴드 종료: 마지막 수시운행 편의 time (10:00이면 10:00까지 수시운행으로 표시)
        const bandEnd = future[j - 1]?.time ?? null
        displayEntries.push({
          type: 'frequent',
          key: `freq-${e.time}-${i}`,
          endTime: bandEnd,
        })
        i = j
      } else {
        const isReturn = e.note?.startsWith?.('회차편') ?? false
        const isFrequentReturn = isReturn && (e.note?.includes?.('수시운행') ?? false)
        // "회차편 · 학교 HH:MM 출발" 에서 하교 출발 시각 추출 (회차편 부제로 사용)
        const originMatch = isReturn && !isFrequentReturn ? e.note?.match?.(/(\d{2}:\d{2})/) : null
        const originTime = originMatch ? originMatch[1] : null
        displayEntries.push({
          type: 'fixed',
          key: `fx-${e.time}-${i}`,
          time: e.time,
          note: e.note,
          isReturn,
          isFrequentReturn,
          originTime,
        })
        i++
      }
    }
  }

  useEffect(() => {
    if (nextRef.current) {
      nextRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [data])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />
  if (!times.length) {
    // 주말·공휴일에 폴백 평일 시간표도 없는 진짜 빈 케이스 (학기 외 등) 명시.
    return <EmptyMsg text={weekend ? '주말·공휴일에는 셔틀이 운행하지 않고, 평일 시간표도 아직 준비되지 않았어요.' : '오늘 셔틀 정보가 없어요'} />
  }

  const allDone = displayEntries.length === 0

  return (
    <div className="flex flex-col gap-2">
      {usingFallback && (
        <div
          className="-mx-4 mb-2 px-5 py-3.5 flex items-start gap-3"
          style={{
            background: 'linear-gradient(135deg, #fef6e6 0%, #fdebcb 100%)',
            borderLeft: '4px solid #d4a14a',
          }}
        >
          <span className="text-[20px] leading-none mt-0.5 flex-shrink-0">⚠</span>
          <div className="dark:text-[#d4a14a]" style={{ color: '#a07517' }}>
            <div className="text-[15px] font-black tracking-tight leading-tight">
              주말·공휴일엔 셔틀버스가 운행하지 않습니다
            </div>
            <div className="text-meta font-semibold mt-1 opacity-90">
              아래는 <span className="font-extrabold">평일 기준 시간표</span>입니다.
            </div>
          </div>
        </div>
      )}
      {data?.schedule_name && !usingFallback && (
        <p className="text-meta font-semibold text-mute dark:text-mute-dark mb-1">
          {data.schedule_name} · 총 {times.length}회 · 남은 {future.length}회
        </p>
      )}
      {data?.schedule_name && usingFallback && (
        <p className="text-meta font-semibold text-mute dark:text-mute-dark mb-1">
          {data.schedule_name} · 총 {times.length}회
        </p>
      )}
      {allDone ? (
        <>
          <div className="flex items-center gap-2 px-1 mb-1">
            <span className="text-meta font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full">
              금일 운행 종료
            </span>
          </div>
          <TimeGrid times={past.map((p) => p.time)} />
        </>
      ) : (
        <>
          {past.slice(-2).map(({ time }, i) => <PastRow key={`p-${i}`} time={time} />)}
          {displayEntries.map((entry, i) => {
          const isNext = i === 0
          let displayTime
          let displayNote = null
          if (entry.type === 'frequent') {
            displayTime = entry.endTime ? `${entry.endTime}까지 수시운행` : '수시운행 중'
          } else if (entry.isFrequentReturn) {
            // 하교 수시운행 회차편 — 하교가 수시라 등교 시각도 보장되지 않으므로 구체 시각 숨김
            displayTime = '하교 수시운행 회차편'
            displayNote = '역 앞에 도착한 버스 탑승'
          } else if (entry.isReturn) {
            // 회차편 도착 시각은 예정치라 숨기고, 하교 출발 시각만 부제로 노출한다.
            // ① 첫 번째 회차편이고 수시 회차 구간 안이면 "수시운행 중"
            // ② 그 외에도 originTime이 하교 수시운행 밴드 안이면 "수시운행 중"
            displayTime = '회차편 탑승'
            const isFreqNow = (isNext && inFrequentReturnWindow) || originTimeInFrequentBand(entry.originTime)
            displayNote = isFreqNow
              ? '하교 버스가 수시운행 중입니다'
              : entry.originTime
                ? `하교 버스가 ${entry.originTime}에 출발합니다`
                : null
          } else {
            displayTime = entry.time
            displayNote = entry.note
          }
          return (
            <TimeRow
              key={entry.key}
              time={displayTime}
              note={displayNote}
              isNext={isNext}
              accentColor={accentColor}
              rowRef={isNext ? nextRef : undefined}
            />
          )
        })}
      </>
    )}
  </div>
)
}


// ─── shared UI ──────────────────────────────────────────────────────────

function LoadingList() {
  return (
    <div className="flex flex-col gap-2 mt-1">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} width="100%" height="3rem" rounded="rounded-xl" />
      ))}
    </div>
  )
}

function ErrorMsg() {
  return (
    <p className="text-sm text-red-400 dark:text-red-500 text-center py-4">
      정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
    </p>
  )
}

function EmptyMsg({ text }) {
  return <p className="text-sm text-slate-400 text-center py-4">{text}</p>
}

// ─── realtime bus history ────────────────────────────────────────────────

function BusHistoryContent({ routeNumber }) {
  const { data, loading, error } = useBusHistoryPreview(routeNumber)
  const anchorRef = useRef(null)

  const now = new Date()
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  useEffect(() => {
    if (anchorRef.current) {
      anchorRef.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [data])

  if (loading) return <LoadingList />
  if (error) return <ErrorMsg />

  const columns = data?.columns ?? []
  if (columns.length === 0) {
    return <EmptyMsg text="아직 쌓인 이력 데이터가 없어요" />
  }

  const stopName = data?.stop_name

  const MAX_PAST = 4

  // 컬럼별 "지금 이후 첫 번째" 인덱스 + 이전 버스 MAX_PAST개만 남기도록 슬라이스
  const colViews = columns.map((col) => {
    const nextIdx = col.times.findIndex((t) => t >= nowStr)
    const sliceStart = nextIdx === -1
      ? Math.max(0, col.times.length - MAX_PAST)
      : Math.max(0, nextIdx - MAX_PAST)
    return {
      ...col,
      times: col.times.slice(sliceStart),
      nextIdx: nextIdx === -1 ? -1 : nextIdx - sliceStart,
      totalCount: col.times.length,
    }
  })

  // 스크롤 앵커: 가장 최근 컬럼의 next 위치
  const anchorColIdx = colViews.length - 1
  const anchorNextIdx = colViews[anchorColIdx].nextIdx

  return (
    <div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 leading-relaxed">
        실시간 GBIS 기반 노선 · 시간표 없음{stopName ? ` · ${stopName}` : ''}
        <br />과거 실제 도착 기록을 날짜별로 표시합니다
      </p>

      {/* 독립 컬럼: 각 날짜가 자체 시간 순으로 쌓임. 행 정렬 없음. */}
      <div className="flex gap-1 -mx-1 px-1">
        {colViews.map((col, ci) => (
          <div key={ci} className="flex-1 min-w-0">
            {/* 헤더 */}
            <div className="text-center py-2 border-b border-slate-200 dark:border-slate-600 mb-0.5">
              <span className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                {col.label}
              </span>
              <span className="block text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {col.day_label}
              </span>
              {col.totalCount === 0 ? (
                <span className="block text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">데이터 없음</span>
              ) : (
                <span className="block text-[9px] text-slate-300 dark:text-slate-600 mt-0.5">총 {col.totalCount}회</span>
              )}
            </div>

            {/* 시간 리스트 */}
            {col.totalCount === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">데이터가 없습니다</p>
            ) : (
              col.times.map((t, i) => {
                const isNext = i === col.nextIdx
                const isPast = col.nextIdx !== -1 ? i < col.nextIdx : false
                const isAnchor = ci === anchorColIdx && i === Math.max(0, anchorNextIdx - 1)
                return (
                  <div
                    key={`${t}-${i}`}
                    ref={isAnchor ? anchorRef : undefined}
                    className={`py-0.5 text-center tabular-nums text-sm rounded-md
                      ${isNext
                        ? 'font-extrabold text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : isPast
                          ? 'text-slate-300 dark:text-slate-600'
                          : 'font-semibold text-slate-700 dark:text-slate-200'
                      }`}
                  >
                    {t}
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── modal shell ────────────────────────────────────────────────────────

const TYPE_LABEL = { bus: '버스', subway: '지하철', shuttle: '셔틀' }
const TYPE_COLOR = { bus: '#3B82F6', subway: '#F5A623', shuttle: '#1b3a6e' }

export default function ScheduleDetailModal({ open, onClose, type, routeCode, routeId = null, stopId = null, direction, subwayKey, title, accentColor, isRealtime = false, isFavorite = false, onToggleFav = null, onShowMap = null }) {
  const sheetRef = useRef(null)
  const [dragY, setDragY] = useState(0)
  const startY = useRef(null)

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setDragY(0)
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ─ drag-to-dismiss on handle ──────────────────────────────────────────
  function onDragStart(e) {
    const y = e.touches ? e.touches[0].clientY : e.clientY
    startY.current = y
  }
  function onDragMove(e) {
    if (startY.current == null) return
    const y = e.touches ? e.touches[0].clientY : e.clientY
    const dy = Math.max(0, y - startY.current)
    setDragY(dy)
  }
  function onDragEnd() {
    if (startY.current == null) return
    const finalY = dragY
    startY.current = null
    if (finalY > 120) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  if (!open) return null

  const fallbackColor = TYPE_COLOR[type] ?? '#64748B'
  const color = accentColor ?? fallbackColor
  const typeLabel = TYPE_LABEL[type] ?? ''

  return createPortal(
    <div
      className="fixed inset-0 z-[100] md:left-0 md:right-auto md:w-[38%] md:bottom-[56px] flex items-end md:items-stretch justify-center md:justify-stretch pointer-events-none"
      aria-modal="true"
      role="dialog"
      aria-label={`${title} 시간표`}
    >
      {/* 모바일: 검정 backdrop. PC: backdrop 없음 (좌측 패널 영역만 차지) */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in pointer-events-auto md:hidden"
        onClick={handleBackdrop}
      />

      <div
        ref={sheetRef}
        className="relative z-10 w-full md:max-w-none md:w-full bg-surface dark:bg-surface-dark rounded-t-[28px] md:rounded-none md:rounded-r-card-pc shadow-2xl md:shadow-card-md flex flex-col pointer-events-auto md:border-r md:border-line dark:md:border-line-dark md:h-full md:animate-slide-in-left animate-slide-up"
        style={{
          maxHeight: '88dvh',
          transform: `translateY(${dragY}px)`,
          transition: startY.current == null ? 'transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* drag handle — tap/swipe to dismiss */}
        <button
          onClick={onClose}
          onTouchStart={onDragStart}
          onTouchMove={onDragMove}
          onTouchEnd={onDragEnd}
          onMouseDown={onDragStart}
          onMouseMove={startY.current != null ? onDragMove : undefined}
          onMouseUp={onDragEnd}
          onMouseLeave={startY.current != null ? onDragEnd : undefined}
          aria-label="닫기 (아래로 드래그)"
          className="flex justify-center pt-3 pb-2 md:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          style={{ touchAction: 'none' }}
        >
          <span className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-500" />
        </button>

        {/* header */}
        <div className="flex items-center gap-3 px-5 pt-3 md:pt-4 pb-3 flex-shrink-0 border-b border-slate-100 dark:border-border-dark">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: color }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-display text-ink dark:text-slate-100 truncate" style={{ letterSpacing: '-0.03em' }}>
              {title}
            </p>
            <p className="text-caption text-mute" style={{ fontWeight: 600 }}>{typeLabel} 시간표</p>
          </div>
          {onShowMap && (
            <button
              onClick={onShowMap}
              aria-label="지도에서 보기"
              title="지도에서 보기"
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <MapPin size={18} className="text-slate-500 dark:text-slate-400" />
            </button>
          )}
          {onToggleFav && (
            <button
              onClick={onToggleFav}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
            >
              <Star
                size={18}
                fill={isFavorite ? 'var(--tj-accent)' : 'none'}
                className={isFavorite ? 'text-accent dark:text-accent-dark' : 'text-slate-400 dark:text-slate-500'}
              />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
          >
            <X size={18} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="px-5 pt-3 pb-1 flex-shrink-0 flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400" />
          <p className="text-xs text-slate-400">
            오늘 기준 · {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>

        {/* scrollable content — bottom padding 확보해 FloatingDock 위로 */}
        <div
          className="flex-1 overflow-y-auto px-4 pt-2"
          style={{ paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1.5rem))' }}
        >
          {type === 'bus' && ROUTE_WAYPOINTS[routeCode] && (
            <div className="-mx-4 mb-4 border-b border-slate-100 dark:border-border-dark pb-2">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-4 mb-3 uppercase tracking-wide">경유 노선</p>
              <RouteProgressStrip routeNo={routeCode} stationId={stopId} hasArrival={false} />
            </div>
          )}
          {type === 'bus' && isRealtime && <BusHistoryContent routeNumber={routeCode} />}
          {type === 'bus' && !isRealtime && <BusContent routeCode={routeCode} routeId={routeId} stopId={stopId} accentColor={color} />}
          {type === 'subway' && <SubwayContent accentColor={color} subwayKey={subwayKey} />}
          {type === 'shuttle' && <ShuttleContent direction={direction} accentColor={color} />}
        </div>
      </div>
    </div>,
    document.body
  )
}
