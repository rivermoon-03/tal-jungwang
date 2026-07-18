import { useEffect, useRef, useState } from 'react'
import { X, TrainFront, RefreshCw, Map } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayTimetable, useSubwayRealtime, normalizeRealtimeStation } from '../../hooks/useSubway'
import { getSpecialTrainIndices } from '../../utils/trainTime'
import { TimeGridView } from '../schedule/ScheduleDetailModal'
import StatusChip from '../ui/StatusChip'

// DESIGN.md §4 모션 이징 — 시트류(GlobalSubwayLineSheet 등)와 동일 토큰 사용.
const EASE = 'var(--e-out)'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

/**
 * 실시간 데이터 freshness 판정.
 * lastSuccessfulRealtimeAt이 현재 시각 기준 60초 이내이고, stale이 false일 때만 true.
 *
 * @param {string|null|undefined} lastSuccessfulRealtimeAt  ISO 8601 타임스탬프
 * @param {boolean} stale  envelope의 stale 플래그
 * @returns {boolean}
 */
export function isRealtimeFresh(lastSuccessfulRealtimeAt, stale) {
  if (stale) return false
  if (!lastSuccessfulRealtimeAt) return false
  const ts = new Date(lastSuccessfulRealtimeAt).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < 60_000
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

function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

// 열차 ETA 레이블 계산
function getEtaLabel(rtTrain) {
  const secs = rtTrain.arrive_seconds
  if (rtTrain.status_code === 1 || rtTrain.status_code === 2) return '이미 도착'
  if (rtTrain.status_code === 0) return '진입 중'
  if (typeof secs === 'number' && secs > 0) {
    if (secs < 60) return '곧 도착'
    return `${Math.ceil(secs / 60)}분`
  }
  if ([3, 4, 5].includes(rtTrain.status_code)) return '곧 도착'
  const count = getStationCount(rtTrain)
  if (count != null && count > 0) return `${count}역 전`
  const msg = cleanMsg(rtTrain.smart_status) || cleanMsg(rtTrain.location_msg) || cleanMsg(rtTrain.status_msg)
  return msg ? (msg.endsWith('중') || msg.endsWith('도착') || msg.endsWith('출발') ? msg : `${msg} 인근`) : '운행 중'
}

// 시간표(depart_at) 배열 → TimeGridView items shape 변환.
// 버스 ScheduleDetailModal의 DirectionBlock(gridItems) 매핑과 동일 패턴 —
// isPast/isNext는 이미 계산된 nextIndex, isLast는 getSpecialTrainIndices의 lastIdx를 그대로 재사용한다.
// (반올림/판정 로직 재복제 금지 — 상위에서 계산된 인덱스만 매핑)
function toGridItems(trains, nextIndex, lastIdx) {
  return trains.map((t, i) => ({
    key: `${t.depart_at}-${i}`,
    time: t.depart_at,
    isPast: nextIndex === -1 ? true : i < nextIndex,
    isNext: i === nextIndex,
    isLast: i === lastIdx,
  }))
}

// 그리드 하단 "다음 열차 · 첫차 · 막차" 한 줄 요약 — 버스 ScheduleDetailModal의 NextMeta 패턴과 동일 스타일.
function ScheduleSummaryLine({ nextTime, firstAt, lastAt }) {
  if (!nextTime && !firstAt && !lastAt) return null
  return (
    <p className="text-caption text-mute dark:text-mute mt-2.5 px-0.5">
      {nextTime && (
        <>
          다음 열차 <b className="text-accent-ink dark:text-accent font-bold">{nextTime}</b> ·{' '}
        </>
      )}
      첫차 {firstAt ?? '—'} · 막차 {lastAt ?? '—'}
    </p>
  )
}

export default function GlobalSubwayDetailSheet() {
  const item = useAppStore((s) => s.subwayDetailSheet)
  const close = useAppStore((s) => s.closeSubwayDetailSheet)
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)

  const [visible, setVisible] = useState(false)

  // 시트가 실제로 열려 있거나 닫힘 애니메이션 중일 때만 폴링 활성화
  // item !== null  : 시트가 열린 상태
  // visible === true: 닫힘 애니메이션이 아직 재생 중 (데이터 유지 필요)
  const sheetOpen = item !== null || visible

  const { data: timetable, loading: ttLoading } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading, refetch } = useSubwayRealtime({ enabled: sheetOpen })
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  // 평일/토/일 탭 (day_type key)
  const [dayType, setDayType] = useState('weekday')
  const prevItem = useRef(null)
  // 그리드에서 "다음 차" 칸으로 최초 진입 시 자동 스크롤 (버스 그리드뷰와 동일 패턴)
  const gridNextRef = useRef(null)

  useEffect(() => {
    if (item) {
      prevItem.current = item
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [item])

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

  const displayed = item ?? prevItem.current

  // ── 시간표 데이터 ──────────────────────────────────────────
  // timetableKey는 단일 키(방향 포함)이거나, dayType별 조합일 수 있음
  // 시도: `${timetableKey}_${dayType}` → fallback: timetableKey 단일
  // displayed가 아직 없을 수도 있으니(시트가 닫혀 있는 렌더) 옵셔널 체이닝으로 안전하게 계산 —
  // 아래 useEffect가 Rules of Hooks를 지키려면 early return보다 앞에서 호출돼야 하고,
  // 그러려면 이 값들도 여기서 먼저 계산돼 있어야 한다.
  const ttKey = displayed && timetable?.[`${displayed.timetableKey}_${dayType}`]
    ? `${displayed.timetableKey}_${dayType}`
    : displayed?.timetableKey
  const trains = (displayed && timetable?.[ttKey]) ?? []

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)

  // 다음 차 칸으로 자동 스크롤 — trains 참조가 아니라 ttKey/nextIndex(원시값)에만 의존해
  // refreshCooldown 등 무관한 리렌더(1초 tick)마다 스크롤이 튀는 것을 방지.
  // (Rules of Hooks: 아래 "!displayed && !visible" early return보다 반드시 앞에 있어야
  //  훅 호출 순서가 렌더마다 달라지지 않는다 — React error #310 재발 방지.)
  useEffect(() => {
    gridNextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'instant' })
  }, [ttKey, nextIndex])

  if (!displayed && !visible) return null

  // ── 실시간 데이터 ──────────────────────────────────────────
  const { items: stationArrivals, stale, lastSuccessfulRealtimeAt } = normalizeRealtimeStation(
    realtimeAll?.[displayed.station]
  )
  const directionArrivals = stationArrivals.filter(
    (a) => a.line === displayed.lineName && a.direction === displayed.direction
  )
  const realtimeTrains = displayed.realtimeTrain ? [displayed.realtimeTrain] : directionArrivals

  // freshness 판정 (60초 이내 + !stale)
  const fresh = isRealtimeFresh(lastSuccessfulRealtimeAt, stale)

  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  // 헤더 압축 스탯용 "지금 오는 차 · 다음 오는 차" 시간표 시각 2개.
  // 실시간이 늘 정확하진 않아 시간표 시각을 메인으로, 실시간은 아래 보조 텍스트로만 보여준다.
  const upcomingScheduleTimes = nextIndex >= 0
    ? [trains[nextIndex]?.depart_at, trains[nextIndex + 1]?.depart_at].filter(Boolean)
    : []

  // 첫차/막차 시각
  const firstAt = firstIdx != null ? trains[firstIdx]?.depart_at : trains[0]?.depart_at
  const lastAt = lastIdx != null ? trains[lastIdx]?.depart_at : trains[trains.length - 1]?.depart_at

  // 그리드 표시용 items — 순수 매핑(반올림/판정 로직 없음)
  const gridItems = toGridItems(trains, nextIndex, lastIdx)

  function handleClose() {
    setVisible(false)
    setTimeout(close, 320)
  }

  const lineColor = displayed.color

  // ── 다음 열차 ETA 블록 (실시간 fresh일 때만) ──────────────
  const nextRealtimeTrain = fresh && realtimeTrains.length > 0 ? realtimeTrains[0] : null
  const secondRealtimeTrain = fresh && realtimeTrains.length > 1 ? realtimeTrains[1] : null

  // 다음 열차 ETA (실시간 우선, 없으면 시간표)
  let etaMinutes = null
  let etaClockStr = null
  let etaUrgent = false
  if (nextRealtimeTrain) {
    const secs = nextRealtimeTrain.arrive_seconds
    if (typeof secs === 'number' && secs > 0) {
      etaMinutes = Math.ceil(secs / 60)
      etaUrgent = secs < 180
    }
    const statusCode = nextRealtimeTrain.status_code
    if ([0, 1, 2].includes(statusCode)) etaUrgent = true
  } else if (nextTrain) {
    const diffMin = timeToMinutes(nextTrain.depart_at) - nowMin
    if (diffMin >= 0) {
      etaMinutes = diffMin
      etaUrgent = diffMin <= 3
    }
  }
  if (nextTrain) etaClockStr = nextTrain.depart_at

  const DAY_TABS = [
    { key: 'weekday', label: '평일' },
    { key: 'saturday', label: '토요일' },
    { key: 'sunday', label: '일요일' },
  ]

  return (
    <>
      {/* 모바일 딤 배경 */}
      <div
        className="fixed inset-0 z-[90] md:hidden"
        style={{
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.3s ${EASE}`,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />

      {/* 시트 본체 */}
      <div
        className="fixed bottom-0 left-0 right-0 h-[84vh] md:right-auto md:w-[38%] md:h-auto md:bottom-[68px] md:top-0 z-[100] bg-surface dark:bg-surface rounded-t-sheet md:rounded-none flex flex-col overflow-hidden"
        style={(() => {
          const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
          if (isDesktop) {
            return {
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(8px)',
              transition: `opacity 0.24s ${EASE}, transform 0.24s ${EASE}`,
              pointerEvents: visible ? 'auto' : 'none',
            }
          }
          return {
            transform: visible ? 'translateY(0)' : 'translateY(100%)',
            transition: `transform 0.3s ${EASE}`,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            pointerEvents: visible ? 'auto' : 'none',
          }
        })()}
      >
        {/* 그래버 */}
        <div className="flex justify-center pt-3.5 pb-1 flex-shrink-0 md:hidden">
          <div className="w-11 h-1 rounded-full bg-line-strong dark:bg-line-strong" />
        </div>

        {/* ── 컬러 헤더 ── 1행: 제목 + 실시간 압축 스탯 + 닫기 / 2행: 보조 액션 ── */}
        <div className="flex flex-col gap-2 px-4 py-3 flex-shrink-0" style={{ background: lineColor }}>
          <div className="flex items-center gap-2.5">
            <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0 opacity-95" />
            <div className="flex-1 min-w-0">
              <p className="text-head font-semibold text-white leading-none">
                {displayed.station}역
              </p>
              <p className="text-caption font-semibold text-white/85 mt-0.5">
                {displayed.lineName} · {displayed.direction}
              </p>
            </div>

            {/* 헤더 압축 스탯 — 시간표 시각(지금 차·다음 차)이 메인, 실시간은 보조 텍스트.
                실시간이 늘 정확하진 않다는 피드백에 따라 시간표를 우선한다. */}
            {upcomingScheduleTimes.length > 0 && (
              <div className="text-right flex-shrink-0 leading-none text-white">
                <p className="leading-none flex items-baseline justify-end gap-1.5">
                  {upcomingScheduleTimes.map((t, i) => {
                    const m = timeToMinutes(t) - nowMin
                    const label = m <= 0 ? '곧' : `${m}분 후`
                    return (
                      <span
                        key={t}
                        className={i === 0 ? 'text-title font-bold' : 'text-label font-semibold text-white/70'}
                      >
                        {label}
                      </span>
                    )
                  })}
                </p>
                <p className="text-meta font-semibold text-white/70 mt-0.5 whitespace-nowrap">
                  {nextRealtimeTrain
                    ? `실시간 ${etaMinutes != null ? `${etaMinutes}분` : getEtaLabel(nextRealtimeTrain)}`
                    : '시간표 기준'}
                </p>
              </div>
            )}

            {/* 닫기 */}
            <button
              onClick={handleClose}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <X size={17} />
            </button>
          </div>

          {/* 보조 액션 행 — 노선도 / 업데이트 */}
          <div className="flex items-center justify-end gap-2">
            {fresh && realtimeTrains.length > 0 && (
              <button
                onClick={() =>
                  setSubwayLineSheet({
                    line: displayed.lineName,
                    direction: displayed.direction,
                    color: lineColor,
                    viewStation: displayed.station,
                    trains: realtimeTrains.map((t) => ({
                      current_station: t.current_station,
                      destination: t.destination,
                      train_no: t.train_no,
                    })),
                  })
                }
                aria-label="노선도 보기"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-caption font-bold bg-black/18 text-white hover:bg-black/30 transition-all min-h-[44px]"
              >
                <Map size={13} />
                <span>노선도</span>
              </button>
            )}

            <button
              onClick={handleManualRefresh}
              disabled={refreshCooldown > 0 || realtimeLoading}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-button text-caption font-bold transition-all min-h-[44px] ${
                refreshCooldown > 0 ? 'bg-black/10 text-white/40' : 'bg-black/18 text-white hover:bg-black/30'
              }`}
            >
              <RefreshCw size={13} className={realtimeLoading ? 'animate-spin' : ''} />
              <span>{refreshCooldown > 0 ? `${refreshCooldown}s` : '업데이트'}</span>
            </button>
          </div>
        </div>

        {/* ── 방향 토글(세그먼트) ─────────────────────────────── */}
        {/* direction은 상위에서 이미 결정되므로, 여기선 표시만 */}
        <div
          className="flex mx-4 mt-3 mb-0 rounded-button p-[3px] gap-[3px] flex-shrink-0"
          style={{ background: 'var(--tj-bg)' }}
        >
          {['상행', '하행'].map((dir) => {
            const isOn = dir === displayed.direction
            return (
              <button
                key={dir}
                disabled
                className={[
                  'flex-1 rounded-badge py-2 px-1.5 text-caption font-bold leading-snug transition-all',
                  isOn
                    ? 'bg-surface dark:bg-surface text-ink dark:text-ink shadow-sm'
                    : 'text-mute dark:text-mute',
                ].join(' ')}
              >
                {dir}
              </button>
            )
          })}
        </div>

        {/* ── 스크롤 영역 ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 요일 탭 + 시간표 그리드 (스크롤 없이 바로 보이도록 최상단 승격) ─── */}
          <div className="px-4 pt-3">
            <div className="flex gap-[18px] border-b border-line dark:border-line mb-3">
              {DAY_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDayType(key)}
                  className={[
                    'border-none bg-transparent text-label font-bold py-2.5 px-0.5 -mb-px border-b-2 transition-colors',
                    dayType === key
                      ? 'text-ink dark:text-ink border-b-2'
                      : 'text-mute dark:text-mute border-b-transparent',
                  ].join(' ')}
                  style={
                    dayType === key
                      ? { borderBottomColor: 'var(--tj-ink)' }
                      : { borderBottomColor: 'transparent' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            {!ttLoading && trains.length > 0 ? (
              <div data-testid="timetable-grid-section">
                <TimeGridView items={gridItems} gridRef={gridNextRef} />
              </div>
            ) : !ttLoading ? (
              <div className="flex items-center justify-center py-12 text-label font-semibold text-mute dark:text-mute">
                시간표 데이터가 없어요
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-label font-semibold text-mute dark:text-mute">
                불러오는 중이에요
              </div>
            )}

            <ScheduleSummaryLine nextTime={etaClockStr} firstAt={firstAt} lastAt={lastAt} />
          </div>

          {/* ── 실시간 상세 (fresh일 때만, 헤더 압축 스탯의 보조 정보) ─────── */}
          {nextRealtimeTrain && (
            <div data-testid="realtime-section" className="mx-4 mt-3 rounded-card overflow-hidden border border-line dark:border-line">
              <div className="flex items-center gap-2 px-4 py-3">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: etaUrgent ? 'var(--tj-imminent)' : 'var(--tj-accent)' }}
                />
                <p className="flex-1 min-w-0 text-head font-semibold text-ink dark:text-ink truncate">
                  {nextRealtimeTrain.destination}행
                  {nextRealtimeTrain.is_last_train && (
                    <StatusChip kind="last" className="ml-2">막차</StatusChip>
                  )}
                </p>
                {etaClockStr && (
                  <span className="text-caption font-bold text-mute dark:text-mute flex-shrink-0">
                    {etaClockStr} 도착
                  </span>
                )}
              </div>
              {(nextRealtimeTrain.status_msg || nextRealtimeTrain.location_msg) && (
                <p className="px-4 pb-3 -mt-1 text-caption font-medium text-mute dark:text-mute">
                  {cleanMsg(nextRealtimeTrain.status_msg)}
                  {nextRealtimeTrain.location_msg ? ` · ${cleanMsg(nextRealtimeTrain.location_msg)}` : ''}
                </p>
              )}

              {/* 다음 다음 열차 (있을 때) */}
              {secondRealtimeTrain && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-line dark:border-line">
                  <div className="w-[5px] h-[5px] rounded-full bg-mute dark:bg-mute flex-shrink-0" />
                  <p className="text-label font-semibold text-ink-2 dark:text-ink-2-dark">
                    다음 열차{' '}
                    <span className="font-semibold text-ink dark:text-ink">
                      {getEtaLabel(secondRealtimeTrain)}
                    </span>{' '}
                    · {secondRealtimeTrain.destination}행
                    {secondRealtimeTrain.is_last_train && (
                      <StatusChip kind="last" className="ml-1.5">막차</StatusChip>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
