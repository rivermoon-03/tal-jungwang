const ACCENT = '#dc2626'

export function isImminent(code) {
  return [0, 1, 5].includes(code)
}

function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

// arrive_seconds → 표시 문자열
export function arrivalLabel(train) {
  if (!train) return null
  if (isImminent(train.status_code)) return '곧 도착'
  const secs = train.arrive_seconds
  if (secs != null && secs >= 0) {
    const mins = Math.ceil(secs / 60)
    return mins <= 0 ? '곧 도착' : `${mins}분 후`
  }
  // arrive_seconds 없을 때 cleanMsg 적용 후 반환
  return cleanMsg(train.location_msg) || cleanMsg(train.status_msg) || '운행 중'
}

export function RealtimeSlot({ train, dir, align, onClick }) {
  const imminent = train ? isImminent(train.status_code) : false
  const label = arrivalLabel(train)

  return (
    <div
      style={{ textAlign: align, cursor: train && onClick ? 'pointer' : 'default', padding: '2px 0' }}
      onClick={train && onClick ? onClick : undefined}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tj-mute)', marginBottom: 2 }}>
        {dir}
      </div>
      {train ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: align === 'right' ? 'flex-end' : 'flex-start', flexWrap: 'wrap', marginBottom: 4 }}>
            <div
              style={{
                fontSize: 11,
                color: imminent ? ACCENT : 'var(--tj-mute-2)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {train.destination}행
            </div>
            {train.is_last_train && (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', background: ACCENT, padding: '1px 5px', borderRadius: 999, lineHeight: 1.4, flexShrink: 0 }}>
                막차
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: imminent ? 18 : 15,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: imminent ? ACCENT : 'var(--tj-ink)',
            }}
          >
            {label}
          </div>
          {!imminent && (train.location_msg || train.status_msg) && (
            <div style={{ fontSize: 10, color: 'var(--tj-mute-2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cleanMsg(train.location_msg || train.status_msg)}
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

export function RealtimeCompactCard({ lineName, symbol, color, upTrain, downTrain, onTrainClick }) {
  const urgent =
    (upTrain && isImminent(upTrain.status_code)) ||
    (downTrain && isImminent(downTrain.status_code))

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: urgent ? '1px solid transparent' : '1px solid var(--tj-line)',
        background: 'transparent',
        boxShadow: urgent ? '0 0 0 1.5px var(--tj-accent) inset' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            width: 22, height: 22, borderRadius: 999, background: color,
            color: '#fff', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 11, fontWeight: 900,
            flexShrink: 0, lineHeight: 1,
          }}
        >
          {symbol}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tj-ink)' }}>
          {lineName}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tj-mute)', fontWeight: 600 }}>
          실시간
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
    </div>
  )
}
