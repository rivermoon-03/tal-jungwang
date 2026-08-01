/**
 * ScheduleSection — 시간표 행 규격 (2026-08 리디자인)
 *
 * 행 구조: grid [시간열 56px 고정][본문][★]
 *  - 시간열: 큰 숫자("4분") + 아래 절대시각("14:48") mute, 본문과 1px 보더로 구분.
 *    임박(--tj-imminent)은 색만 바꾼다(배경/보더/펄스 없음 — DESIGN.md "색만으로 강조").
 *    미운행/데이터 없음 행은 두 줄 안내 텍스트로 대체한다.
 *  - 본문: [노선배지][행선지 풀네임 15px bold, 말줄임 금지][실시간/막차/혼잡 칩] 한 줄 +
 *    아랫줄 경유/안내 텍스트 12.5px(출발 정류장만 bold).
 *  - ★: 즐�겨찾기 토글(선택적) — utils/favKey 스키마 사용은 호출부(SchedulePage) 책임.
 *
 * 버스(실시간/시간표)·지하철·셔틀 세 모드가 이 컴포넌트 하나로 통일된다 — 이전에는
 * 버스만 별도로 components/bus/BusArrivalCard를 썼는데, 그 카드는 행 클릭 시 자체
 * pushState 네비게이트를 내장하고 있어 PC master-detail(우측 인라인 패널) 레이아웃을
 * 깨뜨렸다(결함 #19/#33). 이 컴포넌트는 항상 onClick 콜백만 호출하고 라우팅은
 * 호출부(SchedulePage)가 데스크톱/모바일 분기로 결정한다.
 */
import { Star } from 'lucide-react'
import Skeleton from '../common/Skeleton'
import RouteBadge from '../common/RouteBadge'
import { CrowdedBadge } from '../bus/BusArrivalCard'
import StatusChip from '../ui/StatusChip'

function TimeColumn({ loading, timeLines, minutesUntil, hhmm, imminent }) {
  if (loading) {
    return <Skeleton width="2.5rem" height="1.4rem" rounded="rounded-md" />
  }

  // timeLines: 숫자 카운트다운 대신 짧은 문구 1~2줄을 시간열에 표시한다.
  // 미운행("주말"/"미운행"), 금일종료("금일"/"종료"), 수시운행("수시"/"운행") 등
  // 상태성 문구를 한 자리에서 처리 — em-dash 없이 단어로만 구성한다.
  if (timeLines?.length) {
    return (
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--tj-mute)',
          textAlign: 'center',
          lineHeight: 1.25,
          whiteSpace: 'pre-line',
        }}
      >
        {timeLines.join('\n')}
      </span>
    )
  }

  if (minutesUntil == null && !imminent) {
    return (
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tj-mute)', textAlign: 'center' }}>
        정보 없음
      </span>
    )
  }

  return (
    <>
      <span
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.05,
          color: imminent ? 'var(--tj-imminent)' : 'var(--tj-ink)',
        }}
        className={!imminent ? 'dark:text-ink' : undefined}
      >
        {imminent ? '곧' : minutesUntil >= 60
          ? `${Math.floor(minutesUntil / 60)}시간${minutesUntil % 60 > 0 ? ` ${minutesUntil % 60}분` : ''}`
          : `${minutesUntil}분`}
      </span>
      {hhmm && (
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tj-mute)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {hhmm}
        </span>
      )}
    </>
  )
}

export default function ScheduleSection({
  type = 'bus',
  routeCode,
  title,
  liveChip = false,
  timetableChip = false,
  crowded = 0,
  lastBus = false,
  testBadge = false,
  subtitle = null,
  boldPrefix = null,
  timeLines = null,
  minutesUntil = null,
  hhmm = null,
  imminent = false,
  disabled = false,
  disabledLabel = null,
  isFavorite = false,
  onToggleFavorite = null,
  onClick = null,
  selected = false,
  loading = false,
  footer = null,
}) {
  const badgeRoute = routeCode || (type === 'shuttle' ? '셔틀' : title)

  return (
    <div
      style={{
        borderRadius: 14,
        border: selected ? '1.5px solid var(--tj-accent)' : '1px solid var(--tj-line)',
        background: selected ? 'var(--tj-accent-bg)' : 'transparent',
        overflow: 'hidden',
      }}
    >
      <div
        className={`pressable transition-all duration-150 relative ${onClick && !disabled ? 'cursor-pointer hoverable' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: '56px 1fr auto',
          alignItems: 'stretch',
          opacity: disabled ? 0.75 : 1,
        }}
        onClick={!disabled && onClick ? onClick : undefined}
        role={!disabled && onClick ? 'button' : undefined}
        tabIndex={!disabled && onClick ? 0 : undefined}
        onKeyDown={!disabled && onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      >
        {/* 시간열 56px */}
        <div
          data-testid="schedule-time-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 4px',
            borderRight: '1px solid var(--tj-line)',
          }}
        >
          <TimeColumn
            loading={loading}
            timeLines={timeLines}
            minutesUntil={minutesUntil}
            hhmm={hhmm}
            imminent={imminent}
          />
        </div>

        {/* 본문 */}
        <div style={{ minWidth: 0, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <RouteBadge route={badgeRoute} variant="badge" size="md" />
            <span
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: disabled ? 'var(--tj-mute)' : 'var(--tj-ink)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                minWidth: 0,
              }}
              className="dark:text-ink"
            >
              {title}
            </span>
            {!disabled && liveChip && <StatusChip kind="realtime">실시간</StatusChip>}
            {!disabled && timetableChip && <StatusChip kind="neutral">시간표</StatusChip>}
            {!disabled && crowded > 0 && <CrowdedBadge level={crowded} />}
            {!disabled && lastBus && <StatusChip kind="last">막차</StatusChip>}
            {!disabled && testBadge && <StatusChip kind="beta">베타</StatusChip>}
          </div>

          {disabled && disabledLabel && (
            <p style={{ fontSize: 12.5, color: 'var(--tj-mute)', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
              {disabledLabel}
            </p>
          )}

          {!disabled && subtitle && (
            <p style={{ fontSize: 12.5, color: 'var(--tj-mute)', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
              {boldPrefix && (
                <b style={{ color: 'var(--tj-ink-2)', fontWeight: 800 }} className="dark:text-ink-2">
                  {boldPrefix}
                </b>
              )}
              {subtitle}
            </p>
          )}
        </div>

        {/* 즐겨찾기 */}
        {onToggleFavorite ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
            aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            className="pressable"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              padding: '0 10px',
            }}
          >
            <Star
              size={18}
              fill={isFavorite ? 'var(--tj-imminent)' : 'none'}
              style={{ color: isFavorite ? 'var(--tj-imminent)' : 'var(--tj-mute)' }}
            />
          </button>
        ) : (
          <span style={{ width: 8 }} />
        )}
      </div>
      {!disabled && footer && (
        <div style={{ padding: '6px 12px 10px 68px', borderTop: '1px solid var(--tj-line)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}
