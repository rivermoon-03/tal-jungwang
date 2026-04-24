import { useState, useEffect } from 'react'
import { useSecondsCountdown } from '../../hooks/useSecondsCountdown'
import useAppStore from '../../stores/useAppStore'

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

function ArrivalTime({ item }) {
  const imminent = isImminent(item.status_code)
  const color = imminent ? '#dc2626' : item.color

  // arrive_seconds를 초 단위 카운트다운으로 표시
  const { display, totalSeconds, isUrgent } = useSecondsCountdown(
    imminent ? null : item.arrive_seconds
  )

  // 임박 상태
  if (imminent) {
    if (item.status_code === 1 || item.status_code === 2) {
      return (
        <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
          <span
            className="text-base font-black leading-none tabular-nums"
            style={{ color: '#dc2626', animation: 'pulse 1.5s ease-in-out infinite' }}
          >
            이미
          </span>
          <span className="text-[10px] text-red-400 mt-0.5 font-bold">도착</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
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

  // arrive_seconds 있음 → MM:SS 카운트다운
  if (totalSeconds != null && totalSeconds > 0) {
    const timerColor = isUrgent ? '#dc2626' : color
    if (isUrgent) {
      return (
        <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
          <span className="text-base font-black leading-none" style={{ color: '#dc2626' }}>곧</span>
          <span className="text-[10px] text-red-400 mt-0.5 font-bold">도착</span>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
        <span
          className="text-xl font-black leading-none tabular-nums tracking-tight"
          style={{ color: timerColor }}
        >
          {display}
        </span>
        <span className="text-[10px] text-slate-400 mt-0.5">후 도착</span>
      </div>
    )
  }

  // arrive_seconds 없음 → N전 역 또는 "—"
  const count = getStationCount(item)
  return (
    <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
      <span className={`text-${count ? 'xl' : '2xl'} font-black leading-none tabular-nums ${count ? 'text-slate-700 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'}`}>
        {count ? count : '—'}
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">{count ? '전 역' : '운행중'}</span>
    </div>
  )
}

function RealtimeRow({ item, lastFetchedAt, onClick }) {
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
    ? (darkMode ? 'bg-red-950/30' : 'bg-red-50')
    : 'bg-white dark:bg-surface-dark'

  const destColor = imminent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'
  const recptnTime = item.recptn_dt ? item.recptn_dt.substring(11, 16) : ''

  return (
    <div
      className={`flex flex-col gap-1 px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors ${rowBg}`}
      onClick={() => onClick?.(item)}
    >
      <div className="flex items-center gap-3">
      {/* 좌: 노선 dot + 목적지 + 위치 */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: item.color }}
          />
          <span className="text-[9px] text-slate-400 font-medium leading-none whitespace-nowrap">
            {item.direction}
          </span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap pb-1.5">
            <span className={`text-xl font-extrabold leading-tight tracking-tight ${destColor}`}>
              {item.destination}
              <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-1">행</span>
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
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {formatSubtext(item)}
          </div>
        </div>
      </div>

      <ArrivalTime item={item} />
      </div>

      {/* 하단 업데이트 시간 + 폴링 시간 (별도 행) */}
      {(lastFetchedAt || recptnTime) && (
        <div className="flex justify-end gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
          {lastFetchedAt && (
            <span>{secondsAgo}초 전 폴링</span>
          )}
          {recptnTime && (() => {
            const ageMin = item.recptn_dt
              ? Math.floor((Date.now() - new Date(item.recptn_dt).getTime()) / 60000)
              : 0
            return ageMin >= 3
              ? <span className="text-amber-500 dark:text-amber-400 font-bold">{recptnTime} 기준 · {ageMin}분 지연</span>
              : <span>{recptnTime} 기준</span>
          })()}
        </div>
      )}
    </div>
  )
}

function Section({ lineName, color, items, lastFetchedAt, onRowClick }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{lineName}</span>
      </div>
      {items.map((item) => (
        <RealtimeRow key={item.train_no} item={item} lastFetchedAt={lastFetchedAt} onClick={onRowClick} />
      ))}
    </div>
  )
}

export default function SubwayRealtimeBoard({ arrivals, lastFetchedAt, onRowClick }) {
  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        현재 운행 중인 열차 정보가 없습니다
      </div>
    )
  }

  const line4 = arrivals.filter((a) => a.line === '4호선')
  const suinbundang = arrivals.filter((a) => a.line === '수인분당선')
  const seohae = arrivals.filter((a) => a.line === '서해선')

  return (
    <div className="flex-1 overflow-y-auto">
      <Section lineName="4호선" color="#1B5FAD" items={line4} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} />
      <Section lineName="수인분당선" color="#F5A623" items={suinbundang} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} />
      <Section lineName="서해선" color="#75bf43" items={seohae} lastFetchedAt={lastFetchedAt} onRowClick={onRowClick} />
    </div>
  )
}
