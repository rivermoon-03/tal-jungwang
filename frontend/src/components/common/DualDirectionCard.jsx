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
 *
 * urgent 상태 → Card state="imminent" 토큰 클래스로 처리
 *   bg-imminent/[0.06] border border-imminent rounded-[16px]
 * 기본 상태 → bg-surface border border-line rounded-[16px]
 */
export default function DualDirectionCard({
  symbol,
  symbolColor,
  lineName,
  sub,
  left,
  right,
  onClick,
  onLeftClick,
  onRightClick,
  emptyTitle = '오늘 운행 없음',
  firstLabel = '내일 첫차',
}) {
  const leftEmpty = !left || left.variant === 'empty'
  const rightEmpty = !right || right.variant === 'empty'
  const bothEmpty = leftEmpty && rightEmpty

  const urgent = !!(left?.isUrgent || right?.isUrgent)

  // split-click 모드: 좌우 각각 클릭 가능. 전체-click 모드: 카드 전체가 버튼.
  const splitClick = !!(onLeftClick || onRightClick)
  const isClickable = !!(onClick && !splitClick)
  const Tag = isClickable ? 'button' : 'div'

  // Card state 토큰 — urgent: imminent, 기본: default
  const cardClass = urgent
    ? 'bg-imminent/[0.06] border border-imminent'
    : 'bg-surface border border-line'

  // Card 기본 형태 (rounded-[16px] p-4)
  const interactiveClass = isClickable
    ? 'cursor-pointer transition-transform duration-100 active:scale-[0.98] select-none pressable'
    : ''

  return (
    <Tag
      type={isClickable ? 'button' : undefined}
      onClick={isClickable ? onClick : undefined}
      data-urgent={urgent ? 'true' : 'false'}
      className={[
        'rounded-[16px] p-4 w-full text-left',
        cardClass,
        interactiveClass,
      ].filter(Boolean).join(' ')}
      style={{ fontVariantNumeric: 'tabular-nums' }}
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
            fontSize: 12,
            fontWeight: 900,
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {symbol}
        </span>
        <span className="text-label font-extrabold text-ink">
          {lineName}
        </span>
        {sub && !bothEmpty && (
          <span className="ml-auto text-caption text-mute font-semibold">
            {sub}
          </span>
        )}
      </div>

      {bothEmpty && !splitClick ? (
        <BothEmpty leftSlot={left} rightSlot={right} emptyTitle={emptyTitle} firstLabel={firstLabel} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1px 1fr',
            alignItems: 'start',
            gap: 0,
          }}
        >
          <div
            style={{ padding: '6px 4px', ...(onLeftClick && { cursor: 'pointer' }) }}
            onClick={onLeftClick ? (e) => { e.stopPropagation(); onLeftClick(e) } : undefined}
          >
            <SlotRenderer slot={left} align="left" firstLabel={firstLabel} />
          </div>
          <div
            aria-hidden="true"
            style={{ background: 'var(--tj-line)', width: 1, alignSelf: 'stretch' }}
          />
          <div
            style={{ padding: '6px 4px', textAlign: 'right', ...(onRightClick && { cursor: 'pointer' }) }}
            onClick={onRightClick ? (e) => { e.stopPropagation(); onRightClick(e) } : undefined}
          >
            <SlotRenderer slot={right} align="right" firstLabel={firstLabel} />
          </div>
        </div>
      )}
    </Tag>
  )
}

function BothEmpty({ leftSlot, rightSlot, emptyTitle, firstLabel }) {
  const leftFirst = leftSlot?.firstTomorrow
  const rightFirst = rightSlot?.firstTomorrow
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
      <div className="text-label font-bold text-mute">
        {emptyTitle}
      </div>
      {(leftFirst || rightFirst) ? (
        <div className="flex gap-2.5 text-caption text-mute font-semibold">
          {leftFirst && <span>{leftSlot?.dir ? `${leftSlot.dir} ` : ''}{firstLabel} {leftFirst}</span>}
          {leftFirst && rightFirst && <span className="text-line">|</span>}
          {rightFirst && <span>{rightSlot?.dir ? `${rightSlot.dir} ` : ''}{firstLabel} {rightFirst}</span>}
        </div>
      ) : (
        <div className="text-caption text-mute">
          {firstLabel} 시간을 확인하세요
        </div>
      )}
    </div>
  )
}

function SlotRenderer({ slot, align, firstLabel }) {
  if (!slot || slot.variant === 'empty') {
    return (
      <div style={{ textAlign: align }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4 }}>
          <Moon size={13} strokeWidth={1.8} className="text-mute shrink-0" />
          <span className="text-label font-bold text-mute">운행 없음</span>
        </div>
        {slot?.firstTomorrow && (
          <div className="text-caption text-mute font-semibold mt-0.5">
            {firstLabel} {slot.firstTomorrow}
          </div>
        )}
      </div>
    )
  }
  if (slot.variant === 'return') return <ReturnSlot slot={slot} align={align} />
  if (slot.variant === 'frequent') return <FrequentSlot slot={slot} align={align} />
  return <NormalSlot slot={slot} align={align} />
}

function SlotHeader({ dir, align, extra = null }) {
  // 시안 1: 좌측 "상행 ↑", 우측 "↓ 하행" 거울 대칭
  const arrow = align === 'right' ? '↓' : '↑'
  const label = align === 'right'
    ? <><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tj-mute)' }}>{arrow}</span>{' '}{dir}</>
    : <>{dir}{' '}<span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tj-mute)' }}>{arrow}</span></>
  return (
    <div
      style={{
        display: 'inline-block',
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '0.02em',
          color: 'var(--tj-ink-2)',
        }}
      >
        {label}
      </span>
      {extra}
    </div>
  )
}

/** 진행 바 width 계산: minutes 기준 최대 30분 */
function progressWidth(minutes, isUrgent) {
  if (minutes == null) return 0
  // 30분 기준, 최소 5%
  const pct = Math.max(5, Math.min(100, Math.round((1 - minutes / 30) * 100)))
  return pct
}

function NormalSlot({ slot, align }) {
  const { dir, route, minutes, nextMinutes, isUrgent, imminentLabel } = slot
  const hasMinutes = minutes != null && Number.isFinite(minutes)
  const barWidth = hasMinutes ? progressWidth(minutes, isUrgent) : 0
  const barColor = isUrgent ? 'var(--tj-imminent)' : 'var(--tj-accent, #12a594)'

  return (
    <div style={{ textAlign: align }}>
      <SlotHeader dir={dir} align={align} />
      {route && (
        <div
          style={{
            fontSize: 13,
            color: 'var(--tj-mute)',
            fontWeight: 600,
            marginBottom: 8,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {route}
        </div>
      )}
      {imminentLabel ? (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
              color: 'var(--tj-imminent)',
            }}
          >
            <span
              style={{
                fontSize: 46,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 0.9,
              }}
            >
              {imminentLabel}
            </span>
          </div>
          {nextMinutes != null && Number.isFinite(nextMinutes) && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--tj-mute)',
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              다음 {nextMinutes}분
            </div>
          )}
        </>
      ) : hasMinutes ? (
        <>
          {/* 시안 1: 46px 초대형 카운트다운 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
              gap: 3,
            }}
          >
            <span
              style={{
                fontSize: 46,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 0.9,
                color: isUrgent ? 'var(--tj-imminent)' : 'var(--tj-ink)',
              }}
            >
              {minutes}
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: isUrgent ? 'var(--tj-imminent)' : 'var(--tj-mute)',
              }}
            >
              분
            </span>
          </div>
          {nextMinutes != null && Number.isFinite(nextMinutes) && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--tj-mute)',
                fontWeight: 600,
                marginTop: 6,
              }}
            >
              다음 {nextMinutes}분
            </div>
          )}
          {/* 시안 1: 하단 진행 바 */}
          <div
            data-testid="progress-bar"
            style={{
              height: 4,
              borderRadius: 999,
              background: 'var(--tj-line)',
              marginTop: 10,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                height: '100%',
                borderRadius: 999,
                width: `${barWidth}%`,
                background: barColor,
              }}
            />
          </div>
        </>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: 'var(--tj-mute)',
            fontWeight: 600,
          }}
        >
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
        fontSize: 12,
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
          className="text-caption font-medium mt-1"
          style={{
            color: returnColor,
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
          className="text-caption font-extrabold mt-px"
          style={{ color: returnColor }}
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
          className="text-caption text-mute font-semibold mb-1"
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {route}
        </div>
      )}
      <div className="text-head font-black text-ink" style={{ letterSpacing: '-0.01em', lineHeight: 1.1 }}>
        {freqLabel}
      </div>
      {freqSub && (
        <div className="text-caption text-mute font-semibold mt-0.5">
          {freqSub}
        </div>
      )}
    </div>
  )
}
