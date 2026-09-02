import React, { memo, useState, useEffect, useRef, useId } from 'react';
import { Star } from 'lucide-react';
import useFavorites from '../../hooks/useFavorites';
import StatusChip from '../ui/StatusChip';
import DataBadge from '../ui/DataBadge';
import SubwayDelayBadge from './SubwayDelayBadge';
import { formatEta } from '../../utils/eta';
import { useNow } from '../../hooks/useNow'
import { isRealtimeStale } from './realtimeFreshness'

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
        <DataBadge state="stale" staleAgeText={label} />
      </button>
      {open && (
        // 레거시 rounded-lg/shadow-lg 대신 SubwayDelayBadge 팝오버와 같은
        // rounded-card + shadow-sh-pop 토큰을 쓴다(같은 화면 안 팝오버 스타일 통일).
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-1.5 z-30 w-[240px] px-3 py-2 rounded-card bg-ink text-surface dark:bg-ink dark:text-surface text-caption font-medium leading-relaxed shadow-sh-pop"
        >
          외부 API의 데이터 지연으로 실시간 정보의 정확성을 보장할 수 없는 상태예요.
          화면에 보이는 도착 정보는 약 {minLabel} 전 수신된 데이터로,
          실제 열차 위치와 차이가 있을 수 있어요. 시간표를 함께 확인해 주세요.
        </div>
      )}
    </span>
  )
}

// "베타" 배지가 무엇이 덜 정확한지 설명하는 팝오버. 예전엔 라벨만 있고 이유가
// 없어 사용자가 실시간(베타)를 얼마나 믿어야 할지 알 수 없었다.
// SubwayDelayBadge.jsx의 팝오버 패턴(바깥 탭·Esc 닫기)을 그대로 따른다.
function BetaExplainBadge() {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="실시간(베타) 안내 · 무엇이 덜 정확한지 보기"
        className="pressable inline-flex items-center"
      >
        <StatusChip kind="beta">베타</StatusChip>
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="실시간(베타) 안내"
          className="absolute right-0 top-full mt-1.5 z-30 w-[220px] rounded-card border border-line bg-surface p-3 shadow-sh-pop text-left"
        >
          <p className="text-caption font-bold text-ink">실시간(베타)</p>
          <p className="mt-1.5 text-caption text-ink-2 leading-relaxed">
            도착 예정 시각과 현재 위치는 최근 수신된 실시간 신호를 바탕으로
            추정한 값이에요. 종착역 부근이나 데이터 지연 상황에서는 실제
            열차와 차이가 있을 수 있으니 시간표를 함께 확인하세요.
          </p>
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
    ? 'text-imminent dark:text-imminent'
    : (isNear || !isRunning)
      ? 'text-ink dark:text-ink'
      : 'text-mute dark:text-mute'

  const destColorClass = isUrgent
    ? 'text-imminent dark:text-imminent'
    : 'text-ink dark:text-ink'

  return (
    <div
      className={`py-0.5 ${train && onClick ? 'cursor-pointer' : ''}`}
      style={{ textAlign: align }}
      onClick={train && onClick ? onClick : undefined}
    >
      {/* 방향 라벨 — text-label(13px) */}
      <div className="text-label font-bold text-mute dark:text-mute mb-1 tracking-wide">
        {dir}
      </div>
      {train ? (
        <>
          {/* 목적지 — text-label(13px) */}
          <div
            className="flex items-center gap-1 flex-wrap mb-1.5"
            style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
          >
            <div className={`text-label font-semibold tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${destColorClass}`}>
              {train.destination}행
            </div>
            {train.is_last_train && (
              <StatusChip kind="last">막차</StatusChip>
            )}
          </div>
          {/* ETA — text-head(≥15px) 또는 text-body */}
          <div
            className={`text-head font-bold leading-tight tracking-tight ${labelColorClass}`}
          >
            {label}
          </div>
          {sub && (
            <div className="text-caption font-medium text-mute dark:text-mute mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap">
              {sub}
            </div>
          )}
        </>
      ) : (
        <div className="text-body font-bold text-mute dark:text-mute">
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

  // A6: 백엔드 자체 지연 감지 — 지연 중인 방향의 항목에만 delay_* 필드가 붙는다.
  const upDelay = upTrain?.delay_minutes != null ? upTrain : null
  const downDelay = downTrain?.delay_minutes != null ? downTrain : null

  const isUrgent = upStatus?.level === 'urgent' || downStatus?.level === 'urgent'
  const [secondsAgo, setSecondsAgo] = useState(0)

  // staleSource(예: upTrain.recptn_dt or last_successful_realtime_at) 기준 age(분)
  const nowMs = useNow(60_000)
  const staleRef = staleSource || upTrain?.recptn_dt || downTrain?.recptn_dt
  // 렌더 중 Date.now() 대신 tick 값을 쓴다(순수성 + 표시 자동 갱신).
  const ageMin = staleRef
    ? Math.floor((nowMs - new Date(staleRef).getTime()) / 60000)
    : 0
  // "3분" 임계를 여기서 다시 숫자로 적지 않는다 — subway/realtimeFreshness.js의
  // STALE_THRESHOLD_MS(180_000ms)를 isRealtimeStale()로만 참조한다. 카드/보드가
  // 각자 리터럴을 다시 적어 임계가 어긋난 적이 있었다.
  const isTimeStale = stale || isRealtimeStale(staleRef, nowMs)
  const [chipsExpanded, setChipsExpanded] = useState(false)

  useEffect(() => {
    if (!lastFetchedAt) return
    const update = () => setSecondsAgo(Math.floor((Date.now() - lastFetchedAt) / 1000))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [lastFetchedAt])

  // 헤더 칩 상한 — 카드 하나에 최대 10개 넘는 요소(심볼·노선명·stale·지연×2·베타·
  // 방향별 라벨/행선지/막차/ETA/위치)가 몰려 있었다. 방향별 콘텐츠는 핵심 정보라
  // 그대로 두고, 장식성 칩(stale/지연/베타) 4개만 2개 + "+N"으로 접는다.
  // 우선순위: 지연(실제 문제, 조치 필요) > stale(정보 지연 안내) > 베타(상시 고지).
  const chipItems = []
  if (upDelay) {
    chipItems.push({
      key: 'delay-up',
      node: (
        <SubwayDelayBadge
          key="delay-up"
          direction="상행"
          minutes={upDelay.delay_minutes}
          since={upDelay.delay_since}
          samples={upDelay.delay_samples}
        />
      ),
    })
  }
  if (downDelay) {
    chipItems.push({
      key: 'delay-down',
      node: (
        <SubwayDelayBadge
          key="delay-down"
          direction="하행"
          minutes={downDelay.delay_minutes}
          since={downDelay.delay_since}
          samples={downDelay.delay_samples}
        />
      ),
    })
  }
  if (isTimeStale) {
    chipItems.push({ key: 'stale', node: <StaleHintBadge key="stale" ageMin={ageMin} stale={stale} /> })
  }
  chipItems.push({ key: 'beta', node: <BetaExplainBadge key="beta" /> })

  const CHIP_CAP = 2
  const visibleChips = chipItems.slice(0, CHIP_CAP)
  const overflowChips = chipItems.slice(CHIP_CAP)

  const borderClass = demoted
    ? 'border border-dashed border-line dark:border-line'
    : (isUrgent ? 'border border-transparent' : 'border border-line dark:border-line')
  const bgClass = demoted ? 'bg-surface-2 dark:bg-bg' : 'bg-transparent'
  const paddingClass = demoted ? 'px-3 py-2.5' : 'px-3.5 py-3'
  const titleColorClass = demoted ? 'text-mute dark:text-mute' : 'text-ink dark:text-ink'

  return (
    <div
      className={`relative rounded-card-pc tabular-nums transition-opacity duration-200 ${paddingClass} ${borderClass} ${bgClass}`}
      style={{
        // 인라인 hex 금지 — 임박 강조 링은 --tj-imminent 토큰을 쓴다.
        boxShadow: !demoted && isUrgent ? '0 0 0 1.5px var(--tj-imminent) inset' : 'none',
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
            className={isFavorite ? 'text-yellow-400' : 'text-mute dark:text-mute'}
          />
        </button>
      )}
      <div className={`flex items-center gap-2 flex-wrap ${demoted ? 'mb-2' : 'mb-2.5'}`}>
        {/* 노선 심볼 원형 배지 */}
        <span
          className={`inline-flex items-center justify-center rounded-full text-white flex-shrink-0 font-semibold leading-none ${
            demoted ? 'w-[18px] h-[18px] text-body opacity-85' : 'w-[22px] h-[22px] text-label'
          }`}
          style={{ background: color }}
        >
          {symbol}
        </span>
        {/* 노선명 — text-label(13px) 또는 text-body */}
        <span className={`${demoted ? 'text-body font-bold' : 'text-label font-semibold'} ${titleColorClass}`}>
          {lineName}
        </span>
        {/* 상한 2개 — stale/지연/베타 칩. 나머지는 "+N"으로 접는다(탭하면 펼침). */}
        {visibleChips.map((c) => c.node)}
        {overflowChips.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setChipsExpanded((v) => !v) }}
            aria-expanded={chipsExpanded}
            aria-label={chipsExpanded ? '나머지 배지 접기' : `나머지 배지 ${overflowChips.length}개 더 보기`}
            className="pressable inline-flex items-center rounded-full border border-line px-1.5 py-px text-chip font-medium leading-none text-mute dark:border-line dark:text-mute"
          >
            {chipsExpanded ? '접기' : `+${overflowChips.length}`}
          </button>
        )}
        {chipsExpanded && overflowChips.map((c) => c.node)}
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
        <div aria-hidden className="w-px bg-line dark:bg-line" />
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
        <div className="mt-2 flex justify-end text-caption font-medium text-mute dark:text-mute">
          <span>{secondsAgo}초 전 폴링</span>
        </div>
      )}
    </div>
  )
})
