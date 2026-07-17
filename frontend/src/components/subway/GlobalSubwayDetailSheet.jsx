import { useEffect, useRef, useState } from 'react'
import { X, TrainFront, RefreshCw, Map } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayTimetable, useSubwayRealtime, normalizeRealtimeStation } from '../../hooks/useSubway'
import { getSpecialTrainIndices } from '../../utils/trainTime'
import SubwayTimetable from './SubwayTimetable'
import StatusChip from '../ui/StatusChip'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

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

// 분 → HH:MM 포맷
function minutesToHHMM(min) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
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

  // ── 시간표 데이터 ──────────────────────────────────────────
  // timetableKey는 단일 키(방향 포함)이거나, dayType별 조합일 수 있음
  // 시도: `${timetableKey}_${dayType}` → fallback: timetableKey 단일
  const ttKey = timetable?.[`${displayed.timetableKey}_${dayType}`]
    ? `${displayed.timetableKey}_${dayType}`
    : displayed.timetableKey
  const trains = timetable?.[ttKey] ?? []

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  // 첫차/막차 시각
  const firstAt = firstIdx != null ? trains[firstIdx]?.depart_at : trains[0]?.depart_at
  const lastAt = lastIdx != null ? trains[lastIdx]?.depart_at : trains[trains.length - 1]?.depart_at

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

  const etaColor = etaUrgent ? 'var(--tj-imminent)' : lineColor

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
        className="fixed bottom-0 left-0 right-0 h-[84vh] md:right-auto md:w-[38%] md:h-auto md:bottom-[68px] md:top-0 z-[100] bg-surface dark:bg-surface-dark rounded-t-[18px] md:rounded-none flex flex-col overflow-hidden"
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
          <div className="w-11 h-1 rounded-full bg-mute-2 dark:bg-mute-2-dark" />
        </div>

        {/* ── 컬러 헤더 ──────────────────────────────────────── */}
        <div
          className="flex items-center gap-2.5 px-4 py-3 flex-shrink-0"
          style={{ background: lineColor }}
        >
          <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0 opacity-95" />
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-black text-white leading-none">
              {displayed.station}역
            </p>
            <p className="text-[13px] font-semibold text-white/85 mt-0.5">
              {displayed.lineName} · {displayed.direction}
            </p>
          </div>

          {/* 노선도 버튼 (실시간 데이터가 있을 때) */}
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[13px] font-bold bg-black/18 text-white hover:bg-black/30 transition-all min-h-[44px]"
            >
              <Map size={13} />
              <span>노선도</span>
            </button>
          )}

          {/* 업데이트 버튼 */}
          <button
            onClick={handleManualRefresh}
            disabled={refreshCooldown > 0 || realtimeLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] text-[13px] font-bold transition-all min-h-[44px] ${
              refreshCooldown > 0 ? 'bg-black/10 text-white/40' : 'bg-black/18 text-white hover:bg-black/30'
            }`}
          >
            <RefreshCw size={13} className={realtimeLoading ? 'animate-spin' : ''} />
            <span>{refreshCooldown > 0 ? `${refreshCooldown}s` : '업데이트'}</span>
          </button>

          {/* 닫기 */}
          <button
            onClick={handleClose}
            className="w-[30px] h-[30px] flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* ── 방향 토글(세그먼트) ─────────────────────────────── */}
        {/* direction은 상위에서 이미 결정되므로, 여기선 표시만 */}
        <div
          className="flex mx-4 mt-3 mb-0 rounded-[11px] p-[3px] gap-[3px] flex-shrink-0"
          style={{ background: 'var(--tj-bg)' }}
        >
          {['상행', '하행'].map((dir) => {
            const isOn = dir === displayed.direction
            return (
              <button
                key={dir}
                disabled
                className={[
                  'flex-1 rounded-badge py-2 px-1.5 text-[13px] font-bold leading-snug transition-all',
                  isOn
                    ? 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark shadow-sm'
                    : 'text-mute dark:text-mute-dark',
                ].join(' ')}
              >
                {dir}
              </button>
            )
          })}
        </div>

        {/* ── 스크롤 영역 ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── 실시간 히어로 블록 (fresh일 때만) ─────────────── */}
          {fresh && nextRealtimeTrain && (
            <div data-testid="realtime-section" className="mx-4 mt-3 rounded-card overflow-hidden border border-line dark:border-line-dark">
              {/* 다음 열차 메인 */}
              <div className="px-4 py-3.5">
                <p
                  className="text-[12px] font-black tracking-[0.08em] mb-2"
                  style={{ color: etaUrgent ? 'var(--tj-imminent)' : 'var(--tj-accent)' }}
                >
                  이 열차 실시간
                </p>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-black text-ink dark:text-ink-dark leading-tight">
                      {nextRealtimeTrain.destination}행
                      {nextRealtimeTrain.is_last_train && (
                        <StatusChip kind="last" className="ml-2">막차</StatusChip>
                      )}
                    </p>
                    {(nextRealtimeTrain.status_msg || nextRealtimeTrain.location_msg) && (
                      <p className="text-[13px] font-medium text-mute dark:text-mute-dark mt-1">
                        {cleanMsg(nextRealtimeTrain.status_msg)}
                        {nextRealtimeTrain.location_msg
                          ? ` · ${cleanMsg(nextRealtimeTrain.location_msg)}`
                          : ''}
                      </p>
                    )}
                  </div>
                  {/* ETA 숫자 */}
                  <div className="text-right flex-shrink-0 leading-none" style={{ color: etaColor }}>
                    {etaMinutes != null ? (
                      <>
                        <span className="text-[44px] font-black tracking-tight">{etaMinutes}</span>
                        <span className="text-[16px] font-black ml-0.5">분</span>
                        {etaClockStr && (
                          <p className="text-[13px] font-bold text-mute dark:text-mute-dark mt-1">
                            {etaClockStr} 도착
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-[20px] font-black">
                        {getEtaLabel(nextRealtimeTrain)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 다음 다음 열차 (있을 때) */}
              {secondRealtimeTrain && (
                <div className="flex items-center gap-2 px-4 py-3 border-t border-line dark:border-line-dark">
                  <div className="w-[5px] h-[5px] rounded-full bg-mute dark:bg-mute-dark flex-shrink-0" />
                  <p className="text-[14px] font-semibold text-ink-2 dark:text-ink-2-dark">
                    다음 열차{' '}
                    <span className="font-black text-ink dark:text-ink-dark">
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

          {/* ── 첫차/막차 요약 ──────────────────────────────────── */}
          {(firstAt || lastAt) && (
            <div
              className="grid mx-4 mt-3 rounded-[12px] overflow-hidden"
              style={{
                gridTemplateColumns: '1fr 1px 1fr',
                background: 'var(--tj-bg)',
              }}
            >
              <div className="text-center py-3">
                <p className="text-[13px] font-bold text-mute dark:text-mute-dark mb-0.5">첫차</p>
                <p className="text-[16px] font-black text-ink dark:text-ink-dark tabular-nums">
                  {firstAt ?? '—'}
                </p>
              </div>
              <div
                className="self-center mx-auto"
                style={{ width: 1, height: 28, background: 'var(--tj-line)' }}
              />
              <div className="text-center py-3">
                <p className="text-[13px] font-bold text-mute dark:text-mute-dark mb-0.5">막차</p>
                <p className="text-[16px] font-black text-ink dark:text-ink-dark tabular-nums">
                  {lastAt ?? '—'}
                </p>
              </div>
            </div>
          )}

          {/* ── 시간표 섹션 (메인) ──────────────────────────────── */}
          <div className="mt-3 flex-1">
            {/* 요일 탭 */}
            <div className="flex gap-[18px] px-4 border-b border-line dark:border-line-dark">
              {DAY_TABS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDayType(key)}
                  className={[
                    'border-none bg-transparent text-[14px] font-bold py-2.5 px-0.5 -mb-px border-b-2 transition-colors',
                    dayType === key
                      ? 'text-ink dark:text-ink-dark border-b-2'
                      : 'text-mute dark:text-mute-dark border-b-transparent',
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

            {/* 시간표 리스트 */}
            {!ttLoading && trains.length > 0 ? (
              <SubwayTimetable
                entries={trains}
                nextIndex={nextIndex}
                lastIdx={lastIdx ?? null}
                firstIdx={firstIdx ?? null}
                lineColor={lineColor}
                lineDarkColor={displayed.darkColor}
                lineLightColor={displayed.lightColor}
              />
            ) : !ttLoading ? (
              <div className="flex items-center justify-center py-12 text-[14px] font-semibold text-mute dark:text-mute-dark">
                시간표 데이터가 없어요
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-[14px] font-semibold text-mute dark:text-mute-dark">
                불러오는 중이에요
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
