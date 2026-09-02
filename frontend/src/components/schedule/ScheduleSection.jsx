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
import { Star, Moon } from 'lucide-react'
import Skeleton from '../common/Skeleton'
import RouteBadge from '../ui/RouteBadge'
import { CrowdedBadge } from '../bus/BusArrivalCard'
import StatusChip from '../ui/StatusChip'
import { scaledPx } from '../../utils/fontScale'

function TimeColumn({ loading, timeLines, minutesUntil, hhmm, imminent }) {
  if (loading) {
    return <Skeleton width="2.5rem" height="1.4rem" rounded="rounded-badge" />
  }

  // timeLines: 숫자 카운트다운 대신 짧은 문구 1~2줄을 시간열에 표시한다.
  // 미운행("주말"/"미운행"), 금일종료("금일"/"종료"), 수시운행("수시"/"운행") 등
  // 상태성 문구를 한 자리에서 처리 — em-dash 없이 단어로만 구성한다.
  if (timeLines?.length) {
    return (
      <span
        style={{
          fontSize: scaledPx(13),
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
      <span style={{ fontSize: scaledPx(12), fontWeight: 700, color: 'var(--tj-mute)', textAlign: 'center' }}>
        정보 없음
      </span>
    )
  }

  // eta.js(정본)와 같은 규칙: 60분 초과는 상대 분 대신 절대 시각으로 보여준다.
  // 예전엔 "N시간 M분"을 여기서 직접 조립했는데, 56px 고정 폭의 시간열에서
  // "8시간 4분"처럼 긴 문자열이 "8시간"/"4분" 두 줄로 꺾였다. hhmm(호출부가 이미
  // 계산해 내려주는 HH:MM)은 항상 5글자라 꺾이지 않는다 — 새로 포맷을 만들지
  // 않고 eta.js 규칙이 요구하는 절대 시각을 그대로 큰 글자 자리에 옮겨 쓴다.
  const useAbsoluteTime = !imminent && minutesUntil > 60 && !!hhmm

  return (
    <>
      {/* 목록 기준 시간 계층: 남은 분이 가장 큰 요소다(text-eta-num 토큰, 22px/800).
          상세 시트는 반대(시각이 큼)라 화면마다 다른 훑기 습관을 들이게 했던
          문제를 목록 규격으로 통일한다 — 색만 동적이라 style로 남기고 크기·
          굵기·자간·행간은 토큰 클래스로 옮긴다. */}
      <span
        style={{ color: imminent ? 'var(--tj-imminent)' : 'var(--tj-ink)' }}
        className={`text-eta-num tabular-nums ${!imminent ? 'dark:text-ink' : ''}`}
      >
        {imminent ? '곧' : useAbsoluteTime ? hhmm : `${minutesUntil}분`}
      </span>
      {hhmm && !useAbsoluteTime && (
        <span style={{ fontSize: scaledPx(12), fontWeight: 600, color: 'var(--tj-mute)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
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
  // 지금이 운행 시간대 밖일 때(막차 이후·첫차 이전) 노선명 아래에 붙는 한 줄.
  // 시간열의 "금일 종료"는 56px 안에서 두 단어로 끝나 눈에 잘 안 들어온다 —
  // 본문 쪽에 달 아이콘을 하나 두면 목록을 훑을 때 상태가 먼저 읽힌다.
  sleeping = false,
  sleepingLabel = null,
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
            <RouteBadge route={badgeRoute} variant="solid" />
            <span
              style={{
                fontSize: scaledPx(15),
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
            <p style={{ fontSize: scaledPx(12.5), color: 'var(--tj-mute)', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
              {disabledLabel}
            </p>
          )}

          {sleeping && (
            <p
              style={{ fontSize: scaledPx(12), color: 'var(--tj-mute)', fontWeight: 700, lineHeight: 1.3, margin: 0,
                       display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Moon size={12} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>Zzz</span>
              {sleepingLabel && <span style={{ fontWeight: 600 }}>· {sleepingLabel}</span>}
            </p>
          )}

          {!disabled && subtitle && (
            <p style={{ fontSize: scaledPx(12.5), color: 'var(--tj-mute)', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>
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
