/**
 * FavoritesTimeline — 즐겨찾기 수직 타임라인 뷰 (디자인 번들 FavoritesC).
 *
 * Props:
 *   items   [{ id, routeCode, stationName, destination, minutes, lastTrain, detail }]
 *   onOpenDetail  (detail) => void
 *
 * minutes ASC 정렬. 3분 이하는 ring=accent, urgent pulse.
 */
import RouteBadge from '../common/RouteBadge.jsx'

function resolveDirection(item) {
  const parts = []
  if (item.destination) parts.push(item.destination)
  if (item.stationName) parts.push(item.stationName)
  return parts.length ? parts.join(' · ') : null
}

export default function FavoritesTimeline({ items = [], onOpenDetail }) {
  const sorted = [...items].sort((a, b) => {
    const am = a.minutes == null ? Number.POSITIVE_INFINITY : a.minutes
    const bm = b.minutes == null ? Number.POSITIVE_INFINITY : b.minutes
    return am - bm
  })

  if (sorted.length === 0) return null

  return (
    <div style={{ position: 'relative', padding: '4px 4px 0' }}>
      {/* vertical line */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 14,
          top: 12,
          bottom: 12,
          width: 2,
          background: 'var(--tj-line)',
        }}
      />
      {sorted.map((item) => {
        const m = item.minutes
        const hasMin = m != null && Number.isFinite(m)
        const urgent = hasMin && m <= 3
        const direction = resolveDirection(item)

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenDetail?.(item.detail)}
            className="pressable"
            style={{
              position: 'relative',
              display: 'block',
              width: '100%',
              textAlign: 'left',
              paddingLeft: 36,
              paddingBottom: 16,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {/* dot */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 8,
                top: 6,
                width: 14,
                height: 14,
                borderRadius: 999,
                background: urgent ? 'var(--tj-accent)' : 'var(--tj-bg-soft)',
                border: `2.5px solid ${urgent ? 'var(--tj-accent)' : 'var(--tj-line)'}`,
                boxShadow: '0 0 0 3px var(--tj-bg-soft)',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              {hasMin ? (
                <span
                  className={urgent ? 'tj-urgent' : ''}
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    letterSpacing: '-0.03em',
                    color: urgent ? 'var(--tj-accent)' : 'var(--tj-ink)',
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                  }}
                >
                  {m}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--tj-mute)',
                    lineHeight: 1,
                  }}
                >
                  —
                </span>
              )}
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tj-mute)' }}>
                {hasMin ? '분 뒤' : '정보 없음'}
              </span>
              {item.lastTrain && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--line-express)',
                    color: '#fff',
                    letterSpacing: '0.08em',
                    marginLeft: 4,
                  }}
                >
                  막차
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <RouteBadge route={item.routeCode} variant="chip" size="sm" />
              {direction && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--tj-mute)',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {direction}
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
