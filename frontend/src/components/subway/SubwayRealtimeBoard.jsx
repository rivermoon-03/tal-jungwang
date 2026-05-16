import { useState, useEffect } from 'react'
import { useSecondsCountdown } from '../../hooks/useSecondsCountdown'
import useAppStore from '../../stores/useAppStore'
import { nextTimetableSeconds } from '../../utils/trainTime'

// arvlCd 0,1,3,4,5 → 임박 (빨간색)
function isImminent(statusCode) {
  // 0:진입, 1:도착, 3:전역출발, 4:전역진입, 5:전역도착
  return [0, 1, 3, 4, 5].includes(statusCode)
}

// ordkey에서 남은 정거장 수 추출 (3~5번째 자리)
function getStationCount(ordkey) {
  if (!ordkey || ordkey.length < 5) return null
  const countStr = ordkey.substring(2, 5)
  const count = parseInt(countStr, 10)
  return isNaN(count) ? null : count
}

/**
 * recptn_dt(실시간 API 생성 시각) 또는 last_successful_realtime_at 기준 age(초).
 * 3분(180s) 이상이면 stale로 간주한다.
 */
export function isRealtimeStale(reference) {
  if (!reference) return false
  const ms = new Date(reference).getTime()
  if (Number.isNaN(ms)) return false
  return (Date.now() - ms) >= 180_000
}

/**
 * 시간표 모드 / 실시간 모드 양쪽에서 재사용하는 공통 stale 배지.
 */
export function SubwayStaleBadge({ reference, prefix = '', className = '' }) {
  if (!reference) return null
  const ms = new Date(reference).getTime()
  if (Number.isNaN(ms)) return null
  const ageMin = Math.floor((Date.now() - ms) / 60000)
  if (ageMin < 3) return null
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
      {prefix}데이터 {ageMin}분 지연
    </span>
  )
}

// arvlCd에 따른 한국어 상태 레이블 (fallback용)
function statusLabel(code) {
  switch (code) {
    case 0: return '진입 중'
    case 1: return '이미 도착'
    case 2: return '출발'
    case 3: return '전역 출발'
    case 4: return '전역 진입'
    case 5: return '전역 도착'
    default: return '운행 중'
  }
}

/**
 * smart_status > location_msg 정제 > status_msg > 코드 기반 레이블 순으로 표시.
 */
function formatSubtext(item) {
  if (item.smart_status && item.smart_status !== '운행 중') return item.smart_status
  const { status_code, status_msg, location_msg } = item
  const loc = location_msg?.replace(/\[([^\]]+)\]/g, '$1') ?? ''
  const msg = status_msg?.replace(/\[([^\]]+)\]/g, '$1') ?? ''
  if (isImminent(status_code)) {
    if (loc && loc !== msg) return `${msg || statusLabel(status_code)} · ${loc}`
    return msg || statusLabel(status_code)
  }
  if (loc) return msg && msg !== loc ? `${msg} · ${loc}` : loc
  return msg || statusLabel(status_code)
}

function ArrivalTime({ item, timetableTrains }) {
  const imminent = isImminent(item.status_code)
  // imminent는 토큰 컬러로 통일, 그 외엔 노선 컬러 유지.
  const color = imminent ? '#e26a4d' : item.color

  // 실시간 arrive_seconds 우선. 없거나 0 이하면 시간표 fallback으로 계산.
  const realtimeSecs = imminent ? null : item.arrive_seconds
  const hasRealtimeSecs = typeof realtimeSecs === 'number' && realtimeSecs > 0
  const timetableSecs = hasRealtimeSecs
    ? null
    : nextTimetableSeconds(timetableTrains)

  const { display, totalSeconds, isUrgent } = useSecondsCountdown(
    hasRealtimeSecs ? realtimeSecs : timetableSecs
  )

  // 임박 상태
  if (imminent) {
    if (item.status_code === 1 || item.status_code === 2) {
      return (
        <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
          <span
            className="text-base font-black leading-none tabular-nums"
            style={{ color: '#e26a4d', animation: 'pulse 1.5s ease-in-out infinite' }}
          >
            이미
          </span>
          <span className="text-[10px] text-imminent dark:text-imminent-dark mt-0.5 font-extrabold">도착</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
        <span
          className="text-base font-black leading-none tabular-nums"
          style={{ color: '#dc2626', animation: 'pulse 1.5s ease-in-out infinite' }}
        >
          곧
        </span>
        <span className="text-[10px] text-red-400 mt-0.5 font-bold">도착</span>
      </div>
    )
  }

  // 실시간 또는 시간표 fallback 카운트다운
  if (totalSeconds != null && totalSeconds > 0) {
    const timerColor = isUrgent ? '#dc2626' : color
    const sourceLabel = hasRealtimeSecs ? '후 도착' : '시간표 기준'
    if (isUrgent) {
      return (
        <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
          <span className="text-base font-black leading-none text-imminent dark:text-imminent-dark">곧</span>
          <span className="text-[10px] text-imminent dark:text-imminent-dark mt-0.5 font-extrabold">도착</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
        <span
          className="text-xl font-black leading-none tabular-nums tracking-tight"
          style={{ color: timerColor }}
        >
          {display}
        </span>
        <span className="text-[10px] font-semibold text-mute dark:text-mute-dark mt-0.5">{sourceLabel}</span>
      </div>
    )
  }

  // arrive_seconds도, 시간표도 없음 → N전 역 (실시간 ordkey만 활용)
  const count = getStationCount(item.ordkey)
  if (count) {
    return (
      <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
        <span className="text-xl font-black leading-none tabular-nums text-ink dark:text-ink-dark">
          {count}
        </span>
        <span className="text-[10px] font-semibold text-mute dark:text-mute-dark mt-0.5">전 역</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-line dark:border-line-dark pl-3">
      <span className="text-2xl font-black leading-none tabular-nums text-mute-2 dark:text-mute-2-dark">—</span>
      <span className="text-[10px] font-semibold text-mute dark:text-mute-dark mt-0.5">운행중</span>
    </div>
  )
}

function RealtimeRow({ item, lastFetchedAt, onClick, timetableLookup }) {
  const imminent = isImminent(item.status_code)
  const darkMode = useAppStore((s) => s.darkMode)
  const [secondsAgo, setSecondsAgo] = useState(0)

  useEffect(() => {
    if (!lastFetchedAt) return
    const update = () => setSecondsAgo(Math.floor((Date.now() - lastFetchedAt) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastFetchedAt])

  const rowBg = imminent
    ? 'bg-[rgba(226,106,77,0.06)] dark:bg-[rgba(248,113,113,0.08)]'
    : 'bg-surface dark:bg-surface-dark'

  const destColor = imminent ? 'text-imminent dark:text-imminent-dark' : 'text-ink dark:text-ink-dark'
  const recptnTime = item.recptn_dt ? item.recptn_dt.substring(11, 16) : ''

  return (
    <div
      className={`relative flex flex-col gap-1 px-4 py-3.5 border-b border-line dark:border-line-dark cursor-pointer active:bg-surface-alt dark:active:bg-surface-dark-alt transition-colors ${rowBg}`}
      onClick={() => onClick?.(item)}
    >
      {imminent && (
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-imminent dark:bg-imminent-dark" />
      )}
      <div className="flex items-center gap-3">
      {/* 좌: 노선 dot + 목적지 + 위치 */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: item.color }}
          />
          <span className="text-[9px] font-semibold text-mute dark:text-mute-dark leading-none whitespace-nowrap">
            {item.direction}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap pb-1.5">
            <span className={`text-xl font-extrabold leading-tight tracking-tight ${destColor}`}>
              {item.destination}
              <span className="text-sm font-semibold text-mute dark:text-mute-dark ml-1">행</span>
            </span>
            {item.is_last_train && (
              <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                막차
              </span>
            )}
            {item.train_type && item.train_type !== '일반' && (
              <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
                style={{ background: item.color }}>
                {item.train_type}
              </span>
            )}
          </div>
          <div className="text-meta font-medium text-mute dark:text-mute-dark mt-0.5 truncate">
            {formatSubtext(item)}
          </div>
        </div>
      </div>

      <ArrivalTime
        item={item}
        timetableTrains={timetableLookup?.(item.line, item.direction) ?? null}
      />
      </div>

      {/* 하단 업데이트 시간 + 폴링 시간 (별도 행) */}
      {(lastFetchedAt || recptnTime) && (
        <div className="flex justify-end gap-1.5 text-[10px] font-medium text-mute dark:text-mute-dark mt-0.5">
          {lastFetchedAt && (
            <span>{secondsAgo}초 전 폴링</span>
          )}
          {recptnTime && (() => {
            const ageMin = item.recptn_dt
              ? Math.floor((Date.now() - new Date(item.recptn_dt).getTime()) / 60000)
              : 0
            return ageMin >= 3
              ? <span className="text-state-warn dark:text-amber-400 font-extrabold">{recptnTime} 기준 · 데이터 {ageMin}분 지연</span>
              : <span>{recptnTime} 기준</span>
          })()}
        </div>
      )}
    </div>
  )
}

function Section({ lineName, color, items, lastFetchedAt, onRowClick, timetableLookup }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-surface-alt dark:bg-surface-dark-alt border-b border-line dark:border-line-dark">
        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-meta font-extrabold text-text dark:text-text-dark tracking-tight">{lineName}</span>
      </div>
      {items.map((item) => (
        <RealtimeRow
          key={item.train_no}
          item={item}
          lastFetchedAt={lastFetchedAt}
          onClick={onRowClick}
          timetableLookup={timetableLookup}
        />
      ))}
    </div>
  )
}

/**
 * @param {Array} arrivals  실시간 도착 목록
 * @param {number|null} lastFetchedAt
 * @param {Function} onRowClick
 * @param {Function} [timetableLookup]  (lineName, direction) → trains[] | null
 *                                       arrive_seconds 없을 때 fallback 카운트다운에 사용.
 * @param {boolean} [stale]  envelope.stale: 직전 성공 응답을 fallback으로 보여주는 상태.
 * @param {string|null} [lastSuccessfulRealtimeAt]  ISO8601 KST.
 */
export default function SubwayRealtimeBoard({ arrivals, lastFetchedAt, onRowClick, timetableLookup, stale, lastSuccessfulRealtimeAt }) {
  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-meta font-semibold text-mute dark:text-mute-dark">
        현재 운행 중인 열차 정보가 없습니다
      </div>
    )
  }

  const line4 = arrivals.filter((a) => a.line === '4호선')
  const suinbundang = arrivals.filter((a) => a.line === '수인분당선')
  const seohae = arrivals.filter((a) => a.line === '서해선')

  return (
    <div className="flex-1 overflow-y-auto">
      {(stale || isRealtimeStale(lastSuccessfulRealtimeAt)) && (
        <div className="mx-4 mt-3 mb-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
          <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-tight">
            실시간 데이터가 {stale ? '잠시 끊겼습니다' : '지연되고 있습니다'}. 시간표 정보를 우선 확인하세요.
          </p>
        </div>
      )}
      <Section lineName="4호선" color="#1B5FAD" items={line4} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} timetableLookup={timetableLookup} />
      <Section lineName="수인분당선" color="#F5A623" items={suinbundang} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} timetableLookup={timetableLookup} />
      <Section lineName="서해선" color="#75bf43" items={seohae} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} timetableLookup={timetableLookup} />
    </div>
  )
}
