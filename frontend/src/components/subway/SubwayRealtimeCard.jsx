const ACCENT = '#dc2626'

export function isImminent(code) {
  return [0, 1, 5].includes(code)
}

export function shortMsg(statusMsg) {
  if (!statusMsg) return '운행 중'
  const m = statusMsg.match(/\[(\d+)\]번째 전역/)
  if (m) return `${m[1]}번째 전역`
  if (statusMsg.includes('전역 도착')) return '전역 도착'
  if (statusMsg.includes('도착')) return '도착'
  if (statusMsg.includes('진입')) return '진입 중'
  return '운행 중'
}

export function RealtimeSlot({ train, dir, align, onClick }) {
  const imminent = train ? isImminent(train.status_code) : false

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
          <div
            style={{
              fontSize: 11,
              color: imminent ? ACCENT : 'var(--tj-mute-2)',
              fontWeight: 600,
              marginBottom: 4,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {train.destination}행
          </div>
          <div
            style={{
              fontSize: imminent ? 20 : 15,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: imminent ? ACCENT : 'var(--tj-ink)',
            }}
          >
            {imminent ? '곧 도착' : shortMsg(train.status_msg)}
          </div>
          {!imminent && train.current_station && (
            <div style={{ fontSize: 10, color: 'var(--tj-mute-2)', marginTop: 3 }}>
              현재: {train.current_station}
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
