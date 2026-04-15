/**
 * RouteSpine — 양 끝 라벨 + 중앙 화살표로 노선 방향을 시각화.
 *
 * Props:
 *   leftLabel   — 좌측 종단점 라벨 (예: '시화')
 *   rightLabel  — 우측 종단점 라벨 (예: '강남')
 *   activeSide  — 'left' | 'right'
 *                 도착지(화살표가 가리키는 쪽). 해당 라벨/원이 coral로 강조됨.
 */

const CORAL = '#FF385C'
const MUTED = '#cbd5e1'
const MUTED_DARK = '#64748b'

export default function RouteSpine({ leftLabel, rightLabel, activeSide = 'right' }) {
  const arrowRight = activeSide === 'right'

  return (
    <div className="w-full px-2 py-2 select-none">
      <div className="flex items-center gap-2">
        <span
          className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
          style={{ background: arrowRight ? MUTED : CORAL }}
        />
        <div className="flex-1 relative h-5 flex items-center">
          <div
            className="absolute inset-x-0 h-[2px]"
            style={{ background: MUTED, top: '50%', transform: 'translateY(-50%)' }}
          />
          <span
            className="relative mx-auto text-[12px] font-bold px-1.5 bg-white dark:bg-[#272a33]"
            style={{ color: CORAL }}
          >
            {arrowRight ? '→' : '←'}
          </span>
        </div>
        <span
          className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
          style={{ background: arrowRight ? CORAL : MUTED }}
        />
      </div>

      <div className="flex justify-between mt-1 text-[11px] font-semibold">
        <span style={{ color: arrowRight ? MUTED_DARK : CORAL }}>{leftLabel}</span>
        <span style={{ color: arrowRight ? CORAL : MUTED_DARK }}>{rightLabel}</span>
      </div>
    </div>
  )
}
