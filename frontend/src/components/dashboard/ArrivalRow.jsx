import RouteBadge from '../common/RouteBadge.jsx'

/**
 * ArrivalRow — 도착 정보 공용 행 컴포넌트.
 * 디자인 번들 lib/components.jsx의 ArrivalRow.
 *
 * Props (디자인 번들 정렬):
 *   route          (string)        노선명. RouteBadge에 그대로 전달
 *   routeNumber    (string)        본문 텍스트. 없으면 route 사용 (back-compat)
 *   direction      (string)        방향
 *   minutes        (number|number[])  남은 분 — 배열이면 [first, ...rest]
 *   extraMinutes   (number[])      추가 분 (minutes가 단일 값일 때)
 *   isUrgent       (boolean)       강제 urgent (자동: first <= 3)
 *   lastTrain      (boolean)       막차 chip 표시
 *   status         ('ok'|'warn'|'bad'|null) 작은 상태 dot
 *   onClick        (fn)
 *   rightAddon     (ReactNode)     기존 호환 (분 옆에 붙는 노드)
 *   routeColor     (string)        DEPRECATED — RouteBadge가 대체
 */
export default function ArrivalRow({
  route,
  routeNumber,
  direction,
  minutes,
  extraMinutes = [],
  isUrgent,
  lastTrain = false,
  status = null,
  onClick,
  rightAddon = null,
}) {
  // minutes는 number 또는 number[]로 들어올 수 있음 — 정규화
  const minsArr = Array.isArray(minutes)
    ? minutes
    : minutes != null && Number.isFinite(minutes)
      ? [minutes, ...extraMinutes]
      : extraMinutes
  const first = minsArr[0]
  const rest = minsArr.slice(1, 3)
  const hasFirst = first != null && Number.isFinite(first)
  const urgent = isUrgent ?? (hasFirst && first <= 3)

  const statusColor =
    status === 'ok'   ? 'var(--state-ok)' :
    status === 'warn' ? 'var(--state-warn)' :
    status === 'bad'  ? 'var(--state-bad)' : null

  const titleText = routeNumber ?? route ?? ''
  const badgeRoute = route ?? routeNumber

  return (
    <button
      type="button"
      onClick={onClick}
      data-urgent={urgent ? 'true' : 'false'}
      className="pressable w-full text-left"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 14,
        border: '1px solid var(--tj-line)',
        background: 'transparent',
        boxShadow: urgent ? '0 0 0 1.5px var(--tj-accent) inset' : 'none',
      }}
    >
      <RouteBadge route={badgeRoute} variant="badge" size="sm" />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              color: 'var(--tj-ink)',
            }}
          >
            {titleText}
          </span>
          {lastTrain && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: '0.08em',
                padding: '1px 5px',
                borderRadius: 4,
                background: 'var(--line-express)',
                color: '#fff',
              }}
            >
              막차
            </span>
          )}
          {statusColor && (
            <span
              aria-hidden="true"
              style={{ width: 6, height: 6, borderRadius: 999, background: statusColor }}
            />
          )}
        </div>
        {direction && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--tj-mute)',
              marginTop: 1,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {direction}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ textAlign: 'right' }}>
          {hasFirst ? (
            <>
              <div
                className={urgent ? 'tj-urgent' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 2,
                  justifyContent: 'flex-end',
                  color: urgent ? 'var(--tj-accent)' : 'var(--tj-ink)',
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                >
                  {first}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: urgent ? 'var(--tj-accent)' : 'var(--tj-mute)',
                    fontWeight: 700,
                  }}
                >
                  분
                </span>
              </div>
              {rest.length > 0 && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--tj-mute-2)',
                    marginTop: 2,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {rest.join(' · ')}분
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--tj-mute)' }}>운행 정보 없음</span>
          )}
        </div>
        {rightAddon}
      </div>
    </button>
  )
}
