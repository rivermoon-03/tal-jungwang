import { Moon } from 'lucide-react'

/**
 * DualDirectionCard
 *
 * 한 카드 안에 상·하행(또는 등·하교)을 좌우 듀얼 컬럼으로 배치하는 공용 카드.
 *
 * Props:
 *   symbol       원형 심볼 글자 1~2자 (예: '서', '4', '수')
 *   symbolColor  심볼 배경색
 *   lineName     헤더 텍스트 (예: '서해선')
 *   sub          헤더 우측 보조 라벨 (optional, 예: '다음 열차')
 *   left         좌측 컬럼 DirectionSlot
 *   right        우측 컬럼 DirectionSlot
 *   onClick      카드 전체 클릭 핸들러 (optional)
 *
 * DirectionSlot variants:
 *   - normal:   { variant: 'normal',   dir, route, minutes, nextMinutes, isUrgent? }
 *   - return:   { variant: 'return',   dir, returnChipLabel, time, descLine1, descLine2 }
 *   - frequent: { variant: 'frequent', dir, route, freqLabel, freqSub }
 *   - empty:    { variant: 'empty' }
 *
 * 양쪽 모두 empty면 카드 전체가 "오늘 운행 없음" 단일 카드로 대체된다.
 */
export default function DualDirectionCard({
  symbol,
  symbolColor,
  lineName,
  sub,
  left,
  right,
  onClick,
}) {
  const leftEmpty = !left || left.variant === 'empty'
  const rightEmpty = !right || right.variant === 'empty'
  const bothEmpty = leftEmpty && rightEmpty

  const urgent = !!(left?.isUrgent || right?.isUrgent)

  const Wrapper = onClick ? 'button' : 'div'
  const wrapperProps = onClick
    ? { type: 'button', onClick, 'data-urgent': urgent ? 'true' : 'false' }
    : { 'data-urgent': urgent ? 'true' : 'false' }

  return (
    <Wrapper
      {...wrapperProps}
      className={onClick ? 'pressable w-full text-left' : 'w-full'}
      style={{
        display: 'block',
        padding: '12px 14px',
        borderRadius: 12,
        border: urgent ? '1px solid transparent' : '1px solid var(--tj-line)',
        background: 'transparent',
        boxShadow: urgent ? '0 0 0 1.5px var(--tj-accent) inset' : 'none',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* Header: circular symbol + line name + sub */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: bothEmpty ? 0 : 10,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            background: symbolColor,
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {symbol}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--tj-ink)',
          }}
        >
          {lineName}
        </span>
        {sub && !bothEmpty && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--tj-mute)',
              fontWeight: 600,
            }}
          >
            {sub}
          </span>
        )}
      </div>

      {bothEmpty ? (
        <BothEmpty />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr',
            alignItems: 'stretch',
            gap: 0,
          }}
        >
          <div style={{ padding: '2px 10px 2px 0' }}>
            <SlotRenderer slot={left} align="left" />
          </div>
          <div
            aria-hidden="true"
            style={{ background: 'var(--tj-line)', width: 1 }}
          />
          <div style={{ padding: '2px 0 2px 10px' }}>
            <SlotRenderer slot={right} align="right" />
          </div>
        </div>
      )}
    </Wrapper>
  )
}

function BothEmpty() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px 0 10px',
        gap: 6,
        color: 'var(--tj-mute)',
      }}
    >
      <Moon size={22} strokeWidth={1.6} aria-hidden="true" />
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--tj-mute)' }}>
        오늘 운행 없음
      </div>
      <div style={{ fontSize: 11, color: 'var(--tj-mute-2)' }}>
        내일 첫차 시간을 확인하세요
      </div>
    </div>
  )
}

function SlotRenderer({ slot, align }) {
  if (!slot || slot.variant === 'empty') {
    return (
      <div style={{ textAlign: align }}>
        <div style={{ fontSize: 11, color: 'var(--tj-mute)', fontWeight: 600 }}>
          운행 없음
        </div>
      </div>
    )
  }
  if (slot.variant === 'return') return <ReturnSlot slot={slot} align={align} />
  if (slot.variant === 'frequent') return <FrequentSlot slot={slot} align={align} />
  return <NormalSlot slot={slot} align={align} />
}

function SlotHeader({ dir, align, extra = null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        gap: 6,
        marginBottom: 2,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--tj-mute)',
        }}
      >
        {dir}
      </span>
      {extra}
    </div>
  )
}

function NormalSlot({ slot, align }) {
  const { dir, route, minutes, nextMinutes, isUrgent } = slot
  const hasMinutes = minutes != null && Number.isFinite(minutes)
  return (
    <div style={{ textAlign: align }}>
      <SlotHeader dir={dir} align={align} />
      {route && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--tj-mute-2)',
            fontWeight: 600,
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {route}
        </div>
      )}
      {hasMinutes ? (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
              gap: 2,
              color: isUrgent ? 'var(--tj-accent)' : 'var(--tj-ink)',
            }}
          >
            <span
              style={{
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {minutes}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isUrgent ? 'var(--tj-accent)' : 'var(--tj-mute)',
              }}
            >
              분
            </span>
          </div>
          {nextMinutes != null && Number.isFinite(nextMinutes) && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--tj-mute)',
                fontWeight: 600,
                marginTop: 3,
              }}
            >
              다음 {nextMinutes}분
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--tj-mute)', fontWeight: 600 }}>
          운행 정보 없음
        </div>
      )}
    </div>
  )
}

function ReturnSlot({ slot, align }) {
  const { dir, returnChipLabel, time, descLine1, descLine2 } = slot
  const returnColor = 'var(--tj-return, #b45309)'
  const chip = returnChipLabel ? (
    <span
      style={{
        fontSize: 9,
        fontWeight: 900,
        letterSpacing: '0.02em',
        padding: '1px 5px',
        borderRadius: 4,
        background: returnColor,
        color: '#fff',
        lineHeight: 1.3,
      }}
    >
      {returnChipLabel}
    </span>
  ) : null
  return (
    <div style={{ textAlign: align }}>
      <SlotHeader dir={dir} align={align} extra={chip} />
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color: returnColor,
          marginTop: 2,
        }}
      >
        {time}
      </div>
      {descLine1 && (
        <div
          style={{
            fontSize: 11,
            color: returnColor,
            fontWeight: 500,
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {descLine1}
        </div>
      )}
      {descLine2 && (
        <div
          style={{
            fontSize: 12,
            color: returnColor,
            fontWeight: 800,
            marginTop: 1,
          }}
        >
          {descLine2}
        </div>
      )}
    </div>
  )
}

function FrequentSlot({ slot, align }) {
  const { dir, route, freqLabel, freqSub } = slot
  return (
    <div style={{ textAlign: align }}>
      <SlotHeader dir={dir} align={align} />
      {route && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--tj-mute-2)',
            fontWeight: 600,
            marginBottom: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {route}
        </div>
      )}
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: 'var(--tj-ink)',
          letterSpacing: '-0.01em',
          lineHeight: 1.1,
        }}
      >
        {freqLabel}
      </div>
      {freqSub && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--tj-mute)',
            fontWeight: 600,
            marginTop: 3,
          }}
        >
          {freqSub}
        </div>
      )}
    </div>
  )
}
