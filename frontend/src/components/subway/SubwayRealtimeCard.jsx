import React, { memo, useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';
import useFavorites from '../../hooks/useFavorites';
import StatusChip from '../ui/StatusChip';
import { formatEta } from '../../utils/eta';

// 실시간 데이터가 N분 전 수신된 값임을 알리는 배지 + 탭/호버 시 안내 툴팁.
// "지하철이 지연됐다"가 아니라 "데이터가 지연됐다"는 점을 명시한다.
function StaleHintBadge({ ageMin, stale }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocPointer)
    document.addEventListener('touchstart', onDocPointer)
    return () => {
      document.removeEventListener('mousedown', onDocPointer)
      document.removeEventListener('touchstart', onDocPointer)
    }
  }, [open])

  const label = stale ? '끊김' : `${ageMin}분 전`
  const minLabel = stale ? '수 분' : `${ageMin}분`

  return (
    <span ref={ref} className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        aria-label="실시간 데이터 지연 안내"
        aria-expanded={open}
        className="inline-flex items-center min-h-[44px] min-w-[44px] justify-center px-1"
      >
        <StatusChip kind="beta">{label}</StatusChip>
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-30 w-[240px] px-3 py-2 rounded-lg bg-ink text-surface dark:bg-ink-dark dark:text-surface-dark text-caption font-medium leading-relaxed shadow-lg"
        >
          외부 API의 데이터 지연으로 실시간 정보의 정확성을 보장할 수 없는 상태예요.
          화면에 보이는 도착 정보는 약 {minLabel} 전 수신된 데이터로,
          실제 열차 위치와 차이가 있을 수 있어요. 시간표를 함께 확인해 주세요.
        </div>
      )}
    </span>
  )
}

// 노선 + 정류장 → 기본(등교 방향) favKey. FavoritesPage.SUBWAY_KEY_INFO와 정렬.
function makeSubwayFavKey(lineName, stationName) {
  if (!stationName) return null
  if (lineName === '4호선') return `subway:${stationName}:line4_up`
  if (lineName === '서해선') {
    if (stationName === '초지' || stationName === '초지역') return `subway:${stationName}:choji_up`
    if (stationName === '시흥시청' || stationName === '시흥시청역') return `subway:${stationName}:siheung_up`
    return `subway:${stationName}:up`
  }
  // 수인분당선 기본
  return `subway:${stationName}:up`
}

function getStatusInfo(code) {
  // 0:진입, 1:도착, 2:출발, 3:전역출발, 4:전역진입, 5:전역도착
  const map = {
    0: { label: '진입 중', level: 'urgent' },
    1: { label: '이미 도착', level: 'urgent' },
    2: { label: '출발', level: 'urgent' },
    3: { label: '전역 출발', level: 'near' },
    4: { label: '전역 진입', level: 'near' },
    5: { label: '전역 도착', level: 'near' },
  }
  return map[code] || null
}

function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

// ordkey 또는 status_msg에서 남은 정거장 수 추출
function getStationCount(train) {
  if (!train) return null
  const { ordkey, status_msg } = train

  // 1. ordkey에서 시도 (3~5번째 자리)
  if (ordkey && ordkey.length >= 5) {
    const countStr = ordkey.substring(2, 5)
    const count = parseInt(countStr, 10)
    if (!isNaN(count) && count > 0) return count
  }

  // 2. status_msg에서 시도 (예: "[5]번째 전역")
  if (status_msg) {
    const match = status_msg.match(/\[?(\d+)\]?번째/)
    if (match) return parseInt(match[1], 10)
  }

  return null
}

// 메인 도착 라벨: formatEta 우선 → 세분화 상태 → 정거장 수 → smart_status
function arrivalLabel(train) {
  if (!train) return null

  // 1. 세분화된 상태 코드 처리 (0~5) — 임박 상태 우선
  const statusInfo = getStatusInfo(train.status_code)
  if (statusInfo) {
    return statusInfo.label
  }

  // 2. formatEta — 초 데이터 기반
  const secs = train.arrive_seconds
  if (secs != null) {
    const { text } = formatEta(secs)
    if (text !== '운행 정보 없음') return text
  }

  // 3. 정거장 수 추출 시도
  const count = getStationCount(train)
  if (count != null && count > 0) {
    return `${count}개 역 전`
  }

  // 4. 백엔드 smart_status
  if (train.smart_status && train.smart_status !== '운행 중') {
    const loc = train.current_station || (train.location_msg ? cleanMsg(train.location_msg) : '')
    if (train.smart_status === loc) return '운행 중'
    return train.smart_status
  }

  return '운행 중'
}

// 서브텍스트: 현재 위치 (현재 역명 명시)
function locationSub(train) {
  if (!train) return null
  const loc = train.current_station || (train.location_msg ? cleanMsg(train.location_msg) : null)
  if (loc) return `현재: ${loc}`
  return null
}

// ETA 긴급 여부 결정
function isEtaImminent(train) {
  const statusInfo = train ? getStatusInfo(train.status_code) : null
  if (statusInfo?.level === 'urgent') return true
  const secs = train?.arrive_seconds
  if (secs != null && secs <= 90) return true
  return false
}

export const RealtimeSlot = memo(function RealtimeSlot({ train, dir, align, onClick }) {
  const statusInfo = train ? getStatusInfo(train.status_code) : null
  let label = arrivalLabel(train)
  const isOidoWait = train?.line === '4호선' && train?.direction === '상행' && train?.status_code === 5 && (train?.location_msg?.includes('오이도') || train?.current_station === '오이도')

  if (isOidoWait) {
    label = '오이도'
  }

  const isUrgent = statusInfo?.level === 'urgent' || isOidoWait || isEtaImminent(train)
  const isNear = statusInfo?.level === 'near' && !isOidoWait

  const sub = train ? locationSub(train) : null
  const isRunning = label === '운행 중'

  // 색상 클래스 결정
  const labelColorClass = isUrgent
    ? 'text-imminent dark:text-imminent-dark'
    : (isNear || !isRunning)
      ? 'text-ink dark:text-ink-dark'
      : 'text-mute dark:text-mute-dark'

  const destColorClass = isUrgent
    ? 'text-imminent dark:text-imminent-dark'
    : 'text-ink dark:text-ink-dark'

  return (
    <div
      className={`py-0.5 ${train && onClick ? 'cursor-pointer' : ''}`}
      style={{ textAlign: align }}
      onClick={train && onClick ? onClick : undefined}
    >
      {/* 방향 라벨 — text-label(13px) */}
      <div className="text-label font-bold text-mute dark:text-mute-dark mb-1 tracking-wide">
        {dir}
      </div>
      {train ? (
        <>
          {/* 목적지 — text-label(13px) */}
          <div
            className="flex items-center gap-1 flex-wrap mb-1.5"
            style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
          >
            <div className={`text-label font-extrabold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${destColorClass}`}>
              {train.destination}행
            </div>
            {train.is_last_train && (
              <StatusChip kind="last">막차</StatusChip>
            )}
          </div>
          {/* ETA — text-head(≥15px) 또는 text-body */}
          <div
            className={`text-head font-black leading-tight tracking-tight ${labelColorClass}`}
          >
            {label}
          </div>
          {sub && (
            <div className="text-caption font-medium text-mute dark:text-mute-dark mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
              {sub}
            </div>
          )}
        </>
      ) : (
        <div className="text-body font-bold text-mute dark:text-mute-dark">
          정보 없음
        </div>
      )}
    </div>
  )
})

/**
 * @param {object} props
 * @param {boolean} [props.demoted]  시간표 모드에서 보조 정보로 표시할 때 true.
 *                                    배경/폰트가 dim 처리된다.
 * @param {boolean} [props.stale]     실시간 데이터가 3분 이상 지연됐거나 fallback인 상태.
 * @param {string}  [props.staleSource]  stale 판정용 ISO8601 시각 (recptn_dt 또는 last_success).
 */
export const RealtimeCompactCard = memo(function RealtimeCompactCard({ lineName, symbol, color, upTrain, downTrain, lastFetchedAt, onTrainClick, stationName, demoted = false, stale = false, staleSource = null }) {
  const favKey = makeSubwayFavKey(lineName, stationName)
  const { isFavorite, toggle: toggleFav } = useFavorites(favKey)
  const upStatus = upTrain ? getStatusInfo(upTrain.status_code) : null
  const downStatus = downTrain ? getStatusInfo(downTrain.status_code) : null

  const isUrgent = upStatus?.level === 'urgent' || downStatus?.level === 'urgent'
  const [secondsAgo, setSecondsAgo] = useState(0)

  // staleSource(예: upTrain.recptn_dt or last_successful_realtime_at) 기준 age(분)
  const staleRef = staleSource || upTrain?.recptn_dt || downTrain?.recptn_dt
  const ageMin = staleRef
    ? Math.floor((Date.now() - new Date(staleRef).getTime()) / 60000)
    : 0
  const isTimeStale = stale || ageMin >= 3

  useEffect(() => {
    if (!lastFetchedAt) return
    const update = () => setSecondsAgo(Math.floor((Date.now() - lastFetchedAt) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastFetchedAt])

  const borderClass = demoted
    ? 'border border-dashed border-line dark:border-line-dark'
    : (isUrgent ? 'border border-transparent' : 'border border-line dark:border-line-dark')
  const bgClass = demoted ? 'bg-surface-alt dark:bg-surface-dark-alt' : 'bg-transparent'
  const paddingClass = demoted ? 'px-3 py-2.5' : 'px-3.5 py-3'
  const titleColorClass = demoted ? 'text-mute dark:text-mute-dark' : 'text-ink dark:text-ink-dark'

  return (
    <div
      className={`relative rounded-card-pc tabular-nums transition-opacity duration-200 ${paddingClass} ${borderClass} ${bgClass}`}
      style={{
        boxShadow: !demoted && isUrgent ? '0 0 0 1.5px #4f9fff inset' : 'none',
        opacity: demoted && isTimeStale ? 0.7 : 1,
      }}
    >
      {favKey && !demoted && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggleFav({ type: 'subway', label: `${lineName} ${stationName}` })
          }}
          aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          className="absolute top-2 right-2 p-1 z-10"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <Star
            size={16}
            fill={isFavorite ? 'currentColor' : 'none'}
            className={isFavorite ? 'text-yellow-400' : 'text-mute dark:text-mute-dark'}
          />
        </button>
      )}
      <div className={`flex items-center gap-2 flex-wrap ${demoted ? 'mb-2' : 'mb-2.5'}`}>
        {/* 노선 심볼 원형 배지 */}
        <span
          className={`inline-flex items-center justify-center rounded-full text-white flex-shrink-0 font-black leading-none ${
            demoted ? 'w-[18px] h-[18px] text-body opacity-85' : 'w-[22px] h-[22px] text-label'
          }`}
          style={{ background: color }}
        >
          {symbol}
        </span>
        {/* 노선명 — text-label(13px) 또는 text-body */}
        <span className={`${demoted ? 'text-body font-bold' : 'text-label font-extrabold'} ${titleColorClass}`}>
          {lineName}
        </span>
        {/* stale 배지 — StatusChip 기반, 점선/색점 없음 */}
        {isTimeStale ? <StaleHintBadge ageMin={ageMin} stale={stale} /> : null}
        {/* 베타 칩 — StatusChip, 이모지/점선 없음 */}
        <StatusChip kind="beta" className="ml-auto">베타</StatusChip>
      </div>

      <div className="grid items-stretch" style={{ gridTemplateColumns: '1fr 1px 1fr' }}>
        <div className="pr-2.5 py-0.5">
          <RealtimeSlot
            train={upTrain}
            dir="상행"
            align="left"
            onClick={upTrain && onTrainClick ? () => onTrainClick(upTrain) : null}
          />
        </div>
        <div aria-hidden className="w-px bg-line dark:bg-line-dark" />
        <div className="pl-2.5 py-0.5">
          <RealtimeSlot
            train={downTrain}
            dir="하행"
            align="right"
            onClick={downTrain && onTrainClick ? () => onTrainClick(downTrain) : null}
          />
        </div>
      </div>
      {lastFetchedAt && (
        <div className="mt-2 flex justify-end text-caption font-medium text-mute dark:text-mute-dark">
          <span>{secondsAgo}초 전 폴링</span>
        </div>
      )}
    </div>
  )
})
