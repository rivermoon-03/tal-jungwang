import RouteBadge from '../common/RouteBadge.jsx'
import { CrowdedBadge } from '../bus/BusArrivalCard.jsx'

export default function ArrivalRow({
  route,
  routeNumber,
  direction,
  subdirection = null,
  minutes,
  extraMinutes = [],
  isUrgent,
  lastTrain = false,
  returnTrip = false,
  status = null,
  onClick,
  rightAddon = null,
  crowded = 0,
}) {
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
        gap: 10,
        padding: '14px 12px',
        borderRadius: 12,
        border: '1px solid var(--tj-line)',
        background: urgent ? '#fafafa' : 'transparent',
        boxShadow: 'none',
      }}
    >
      <RouteBadge route={badgeRoute} variant="tag" />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={
              subdirection != null
                ? {
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    color: 'var(--tj-ink)',
                  }
                : {
                    fontSize: 16,
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                    color: 'var(--tj-ink)',
                  }
            }
          >
            {subdirection != null ? direction : titleText}
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
          {returnTrip && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 900,
                letterSpacing: '0.04em',
                padding: '1px 5px',
                borderRadius: 4,
                background: '#b45309',
                color: '#fff',
              }}
            >
              회차탑승
            </span>
          )}
          {statusColor && (
            <span
              aria-hidden="true"
              style={{ width: 6, height: 6, borderRadius: 999, background: statusColor }}
            />
          )}
          {rightAddon}
          {crowded > 0 && <CrowdedBadge level={crowded} />}
        </div>
        {(subdirection != null ? subdirection : direction) && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--tj-mute)',
              marginTop: 3,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {subdirection != null ? subdirection : direction}
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
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 2,
                  justifyContent: 'flex-end',
                  color: urgent ? '#dc2626' : 'var(--tj-ink)',
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
                    fontSize: 13,
                    color: urgent ? '#dc2626' : 'var(--tj-mute)',
                    fontWeight: 700,
                  }}
                >
                  분
                </span>
              </div>
              {rest[0] != null && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--tj-mute-2)',
                    marginTop: 2,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {`${rest[0]}분`}
                </div>
              )}
            </>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--tj-mute)' }}>운행 정보 없음</span>
          )}
        </div>
      </div>
    </button>
  )
}
