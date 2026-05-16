import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import useFavorites from '../../hooks/useFavorites';

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

const ACCENT = '#dc2626'
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

// 메인 도착 라벨: 세분화된 상태 → 정거장 수 → 시간 → smart_status
function arrivalLabel(train) {
  if (!train) return null
  
  // 1. 세분화된 상태 코드 처리 (0~5)
  const statusInfo = getStatusInfo(train.status_code)
  if (statusInfo) {
    return statusInfo.label
  }

  // 2. 정거장 수 추출 시도 (사용자 요청: 남은 정거장 수 우선)
  const count = getStationCount(train)
  if (count != null && count > 0) {
    return `${count}개 역 전`
  }

  // 3. 실시간 시간 데이터가 있는 경우
  const secs = train.arrive_seconds
  if (secs != null && secs > 0 && secs < 60) {
    return '곧 도착'
  }
  if (secs != null && secs > 0) {
    const mins = Math.ceil(secs / 60)
    return mins <= 0 ? '곧 도착' : `${mins}분 후`
  }

  // 4. 시간은 없지만 백엔드에서 정제된 상태 메시지가 있는 경우
  // 만약 smart_status가 단순 역 이름이라면 (locationSub와 중복) '운행 중'으로 표시
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

export function RealtimeSlot({ train, dir, align, onClick }) {
  const statusInfo = train ? getStatusInfo(train.status_code) : null
  let label = arrivalLabel(train)
  const isOidoWait = train?.line === '4호선' && train?.direction === '상행' && train?.status_code === 5 && (train?.location_msg?.includes('오이도') || train?.current_station === '오이도')
  
  if (isOidoWait) {
    label = '오이도'
  }

  const isUrgent = statusInfo?.level === 'urgent' || isOidoWait
  const isNear = statusInfo?.level === 'near' && !isOidoWait

  const sub = train ? locationSub(train) : null
  const isRunning = label === '운행 중'
  // 타이포그래피 강조: labelSize
  const labelSize = (isUrgent || isNear) ? 20 : isRunning ? 14 : 18

  // 색상 결정
  const labelColor = isUrgent 
    ? ACCENT 
    : (isNear || !isRunning) 
      ? 'var(--tj-ink)' 
      : 'var(--tj-mute)'

  return (
    <div
      style={{ textAlign: align, cursor: train && onClick ? 'pointer' : 'default', padding: '2px 0' }}
      onClick={train && onClick ? onClick : undefined}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tj-mute)', marginBottom: 4 }}>
        {dir}
      </div>
      {train ? (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
            flexWrap: 'wrap', marginBottom: 6,
          }}>
            <div style={{
              fontSize: 14,
              color: isUrgent ? ACCENT : 'var(--tj-ink)',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '-0.01em',
            }}>
              {train.destination}행
            </div>
            {train.is_last_train && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: ACCENT, padding: '1px 5px', borderRadius: 999, lineHeight: 1.4, flexShrink: 0 }}>
                막차
              </span>
            )}
          </div>
          <div style={{
            fontSize: labelSize,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: labelColor,
          }}>
            {label}
          </div>
          {sub && (
            <div style={{ 
              fontSize: 12, 
              color: 'var(--tj-mute-2)', 
              marginTop: 6, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              fontWeight: 500 
            }}>
              {sub}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--tj-mute)', fontWeight: 700 }}>
          정보 없음
        </div>
      )}
    </div>
  )
}

/**
 * @param {object} props
 * @param {boolean} [props.demoted]  시간표 모드에서 보조 정보로 표시할 때 true.
 *                                    배경/폰트가 dim 처리되고 "참고" 라벨이 붙는다.
 * @param {boolean} [props.stale]     실시간 데이터가 3분 이상 지연됐거나 fallback인 상태.
 * @param {string}  [props.staleSource]  stale 판정용 ISO8601 시각 (recptn_dt 또는 last_success).
 */
export function RealtimeCompactCard({ lineName, symbol, color, upTrain, downTrain, lastFetchedAt, onTrainClick, stationName, demoted = false, stale = false, staleSource = null }) {
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

  // demoted: 시간표 모드의 보조 카드 → 옅은 배경 + 점선 보더 + dim
  // urgent는 demoted여도 약한 강조 유지 (사용자가 임박 정보를 놓치지 않게)
  const baseBorder = demoted
    ? '1px dashed var(--tj-line)'
    : (isUrgent ? '1px solid transparent' : '1px solid var(--tj-line)')
  const baseBackground = demoted ? 'var(--tj-bg-mute, rgba(148,163,184,0.06))' : 'transparent'
  const baseOpacity = demoted && isTimeStale ? 0.7 : 1
  const titleColor = demoted ? 'var(--tj-mute)' : 'var(--tj-ink)'

  return (
    <div
      style={{
        padding: demoted ? '10px 12px' : '12px 14px',
        borderRadius: 12,
        border: baseBorder,
        background: baseBackground,
        boxShadow: !demoted && isUrgent ? '0 0 0 1.5px var(--tj-accent) inset' : 'none',
        fontVariantNumeric: 'tabular-nums',
        position: 'relative',
        opacity: baseOpacity,
        transition: 'opacity 0.2s',
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
            className={isFavorite ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}
          />
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: demoted ? 8 : 10, flexWrap: 'wrap' }}>
        <span
          style={{
            width: demoted ? 18 : 22, height: demoted ? 18 : 22, borderRadius: 999, background: color,
            color: '#fff', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: demoted ? 10 : 11, fontWeight: 900,
            flexShrink: 0, lineHeight: 1,
            opacity: demoted ? 0.85 : 1,
          }}
        >
          {symbol}
        </span>
        <span style={{ fontSize: demoted ? 12 : 13, fontWeight: demoted ? 700 : 800, color: titleColor }}>
          {lineName}
        </span>
        {isTimeStale ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {stale ? '실시간 일시 끊김' : `${ageMin}분 지연`}
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', fontSize: demoted ? 10 : 11, color: 'var(--tj-mute)', fontWeight: 600 }}>
          {demoted ? '참고 · 실시간 (베타)' : '실시간 (베타)'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', alignItems: 'stretch' }}>
        <div style={{ padding: '2px 10px 2px 0' }}>
          <RealtimeSlot
            train={upTrain}
            dir="상행"
            align="left"
            onClick={upTrain && onTrainClick ? () => onTrainClick(upTrain) : null}
          />
        </div>
        <div aria-hidden style={{ background: 'var(--tj-line)', width: 1 }} />
        <div style={{ padding: '2px 0 2px 10px' }}>
          <RealtimeSlot
            train={downTrain}
            dir="하행"
            align="right"
            onClick={downTrain && onTrainClick ? () => onTrainClick(downTrain) : null}
          />
        </div>
      </div>
      {(upTrain?.recptn_dt || downTrain?.recptn_dt || lastFetchedAt) && (
        <div style={{ marginTop: 8, textAlign: 'right', fontSize: 9, color: 'var(--tj-mute)', fontWeight: 500, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {lastFetchedAt && <span>{secondsAgo}초 전 폴링</span>}
          {(upTrain?.recptn_dt || downTrain?.recptn_dt) && (
            <span>{(upTrain?.recptn_dt || downTrain?.recptn_dt).substring(11, 16)} 기준</span>
          )}
        </div>
      )}
    </div>
  )
}
