import RouteChip from './RouteChip'
import SlotNumber from './SlotNumber'

// 한 노선의 도착 정보 한 줄.
// 그룹 첫 행이 아니면 헤어라인이 위에 표시됨 (border-top in CSS).
//
// imminent: true면 빨강 + halo pulse 애니메이션.
// "곧" 같이 글자 표시일 때는 children으로 React 노드 받음.
export default function RouteRow({
  route,
  routeLabel,
  destination,
  etaMin,
  etaSub,
  imminent = false,
  onClick,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-[9px] text-left border-t border-line dark:border-line-dark first:border-t-0 ${onClick ? 'pressable' : ''} ${className}`}
    >
      <RouteChip route={route} label={routeLabel ?? route} />
      <span className="flex-1 min-w-0 truncate text-dest-mob md:text-dest text-text dark:text-text-dark">
        {destination}
      </span>
      <span className="text-right whitespace-nowrap shrink-0">
        <Eta value={etaMin} imminent={imminent} />
        {etaSub && (
          <span className="block mt-[1px] text-[9px] font-medium text-mute dark:text-mute-dark tabular-nums">
            {etaSub}
          </span>
        )}
      </span>
    </Tag>
  )
}

function Eta({ value, imminent }) {
  // 문자열 ("곧") 또는 숫자
  const isText = typeof value === 'string' && !/^\d+$/.test(value)
  const cls = `inline-flex items-baseline font-black leading-none tracking-[-0.03em] tabular-nums ${
    imminent
      ? 'text-imminent dark:text-imminent-dark relative'
      : 'text-ink dark:text-white'
  }`
  if (isText) {
    return (
      <span className={`${cls} text-eta-mob md:text-eta-pc`}>
        <span className={imminent ? 'relative' : ''}>
          {value}
          {imminent && (
            <span
              aria-hidden="true"
              className="absolute -inset-2 rounded-[14px] pointer-events-none animate-halo-pulse dark:animate-halo-pulse-dark"
            />
          )}
        </span>
      </span>
    )
  }
  return (
    <span className={`${cls} text-eta-mob md:text-eta-pc`}>
      <SlotNumber value={value} />
      <span className="ml-[1px] text-[8px] font-bold text-mute dark:text-mute-dark">분</span>
    </span>
  )
}
