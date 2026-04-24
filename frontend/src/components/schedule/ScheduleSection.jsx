/**
 * ScheduleSection — 시간표 카드 (디자인 번들 ScheduleA 정렬).
 * 즐겨찾기·지도에서 보기 액션은 상세 모달 내부로 이동.
 */
import { ChevronRight } from 'lucide-react'
import Skeleton from '../common/Skeleton'
import RouteBadge from '../common/RouteBadge'
import { CrowdedBadge } from '../bus/BusArrivalCard'
import { formatRelAbs } from '../../utils/trainTime'

/**
 * next/afterNext 프롭은 아래 두 가지 형태를 모두 허용한다.
 *  - string: 기존 호환 ("곧 도착", "금일 종료", "수시운행 중" 등 상태 라벨)
 *  - { minutes, hhmm }: 상대(분)/절대(HH:MM) 값을 함께 표시 → `${minutes}분 뒤 · ${hhmm}`
 */
function renderTimeValue(value) {
  if (value == null) return '—'
  if (typeof value === 'object') return formatRelAbs(value.minutes, value.hhmm)
  return value
}

export default function ScheduleSection({
  title,
  subtitle,
  type = 'bus',
  routeCode,
  destLabel = null,
  next,
  afterNext,
  onClick,
  loading = false,
  realtimeOnly = false,
  disabled = false,
  disabledLabel = '일부 역 정보는 지원 예정',
  // eslint-disable-next-line no-unused-vars
  lineColor = null,
  minutesUntil = null,
  extraTimes = null,
  testBadge = false,
  footer = null,
  order = 0,
  crowded = 0,
  endOfDay = false,
  lastBus = false,
}) {
  // 노선명을 RouteBadge에 그대로 전달 (지하철/셔틀/버스 모두 처리)
  const badgeRoute = routeCode || (type === 'shuttle' ? '셔틀' : title)

  return (
    <div
      className={`pressable transition-all duration-150 ${
        disabled ? 'opacity-50' : ''
      } ${
        onClick && !disabled ? 'cursor-pointer hover:border-slate-200 dark:hover:border-slate-600' : ''
      }`}
      style={{
        padding: 12,
        borderRadius: 14,
        border: '1px solid var(--tj-line)',
        background: 'transparent',
        order,
      }}
      onClick={!disabled && onClick ? onClick : undefined}
      role={!disabled && onClick ? 'button' : undefined}
      tabIndex={!disabled && onClick ? 0 : undefined}
      onKeyDown={!disabled && onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <RouteBadge route={badgeRoute} variant="badge" size="sm" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--tj-ink)',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
              className="dark:text-slate-100"
            >
              {title}
            </span>
            {destLabel && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--tj-mute-2)',
                  whiteSpace: 'nowrap',
                }}
              >
                {destLabel}
              </span>
            )}
          </div>
          {(subtitle || (!disabled && !loading && testBadge)) && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--tj-mute)',
                fontWeight: 500,
                marginTop: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
              }}
            >
              {subtitle && (
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {subtitle}
                </span>
              )}
              {!disabled && !loading && testBadge && (
                <span
                  style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontWeight: 700,
                    background: 'rgba(37, 99, 235, 0.12)',
                    color: '#2563eb',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                  title="베타 중인 기능입니다. 정확성이 떨어지니 참고용으로만 사용해 주세요"
                >
                  베타
                </span>
              )}
              {!disabled && !loading && lastBus && (
                <span
                  style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontWeight: 700,
                    background: 'rgba(220, 38, 38, 0.12)',
                    color: '#dc2626',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  막차
                </span>
              )}
            </div>
          )}
          {/* 시간 라인 */}
          <div style={{ marginTop: 4, fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minHeight: 16 }}>
            {disabled ? (
              <span style={{ color: 'var(--tj-mute-2)' }}>{disabledLabel}</span>
            ) : endOfDay ? (
              <span style={{ color: 'var(--tj-mute-2)', fontWeight: 600 }}>오늘 버스가 끊겼어요</span>
            ) : realtimeOnly ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '1.5px 7px',
                  borderRadius: 999,
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: '#2563eb',
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: '0.04em',
                }}
              >
                실시간
              </span>
            ) : loading ? (
              <Skeleton width="9rem" height="0.95rem" rounded="rounded-md" />
            ) : (
              <>
                <span style={{ fontWeight: 800, color: 'var(--tj-ink)' }} className="dark:text-slate-100">
                  다음 {renderTimeValue(next)}
                </span>
                {afterNext && (
                  <span style={{ color: 'var(--tj-mute-2)', fontWeight: 500, marginLeft: 8 }}>
                    그 다음 {renderTimeValue(afterNext)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* 오른쪽 display 크기 분 표시 — 고정 폭으로 행간 아이콘 정렬 유지 */}
        {!disabled && !loading && endOfDay && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginLeft: 8,
              flexShrink: 0,
              color: 'var(--tj-mute)',
              textAlign: 'right',
            }}
            className="dark:text-slate-400"
          >
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>금일</span>
            <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>종료</span>
          </div>
        )}
        {!disabled && !loading && !endOfDay && minutesUntil != null && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginLeft: 8,
              minWidth: 56,
              flexShrink: 0,
              fontVariantNumeric: 'tabular-nums',
              color: minutesUntil <= 3 ? 'var(--tj-accent)' : 'var(--tj-ink)',
            }}
            className={minutesUntil <= 3 ? 'tj-urgent dark:text-slate-100' : 'dark:text-slate-100'}
          >
            {minutesUntil <= 0 ? (
              <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                곧 도착
              </span>
            ) : minutesUntil >= 60 ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {Math.floor(minutesUntil / 60)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em' }}>시간</span>
                {minutesUntil % 60 > 0 && (
                  <>
                    <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, marginLeft: 3 }}>
                      {minutesUntil % 60}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '-0.01em' }}>분</span>
                  </>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {minutesUntil}
                </span>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '-0.02em' }}>분</span>
              </div>
            )}
            {crowded > 0 && (
              <div style={{ marginTop: 3 }}>
                <CrowdedBadge level={crowded} />
              </div>
            )}
          </div>
        )}

        {onClick && (
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" aria-hidden="true" />
        )}
      </div>

      {footer}

      {/* 추가 시간 (셔틀) */}
      {!disabled && !loading && Array.isArray(extraTimes) && extraTimes.length > 0 && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--tj-line-soft)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2px 12px',
          }}
        >
          {extraTimes.map((t, i) => (
            <span
              key={`${t}-${i}`}
              style={{
                fontSize: 11,
                color: 'var(--tj-mute)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
