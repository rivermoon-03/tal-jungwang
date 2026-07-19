// p10/p50/p90 분 단위 도착 간격 분포를 가로 레인지 바로 시각화한다.
// 구성: 전체 트랙(bg-surface-3, 4px, rounded-full) + p10~p90 밴드(accent 반투명)
//       + 양끝 캡(p10/p90 경계 표시) + 중앙값 도트(accent, surface 보더).
// variant='mini'  — 카드 하단용, 라벨 없음, 도트가 조금 작다.
// variant='full'  — p10/중앙값/p90 라벨 포함, 시트 헤더용.
// maxMin 기본 20분, p90이 그보다 크면 자동 확장.
//
// 위치 계산(valueToPercent)은 utils/arrivalDistribution.js에 순수 함수로 분리했다
// (컴포넌트 파일이 순수 함수까지 export하면 Fast Refresh 규칙 위반).
import { valueToPercent } from '../../utils/arrivalDistribution'

export default function ArrivalDistributionBar({
  p10Min,
  p50Min,
  p90Min,
  variant = 'mini',
  maxMin: maxMinProp,
}) {
  if (p10Min == null || p50Min == null || p90Min == null) return null

  const maxMin = Math.max(maxMinProp ?? 20, p90Min + 1)
  const leftPct = valueToPercent(p10Min, 0, maxMin)
  const rightPct = valueToPercent(p90Min, 0, maxMin)
  const widthPct = Math.max(rightPct - leftPct, 1.5)
  const dotPct = valueToPercent(p50Min, 0, maxMin)

  const isFull = variant === 'full'
  const dotSize = isFull ? 'w-3 h-3' : 'w-2.5 h-2.5'
  const capHeight = isFull ? 'h-2' : 'h-1.5'

  return (
    <div className="w-full">
      <div className="relative w-full h-1 rounded-full bg-surface-3">
        {/* p10~p90 밴드 */}
        <div
          className="absolute top-0 bottom-0 rounded-full bg-accent/30"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        {/* 양끝 캡 (p10 / p90 경계) */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] ${capHeight} rounded-full bg-accent/70`}
          style={{ left: `${leftPct}%` }}
          aria-hidden="true"
        />
        <span
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[3px] ${capHeight} rounded-full bg-accent/70`}
          style={{ left: `${rightPct}%` }}
          aria-hidden="true"
        />
        {/* 중앙값 도트 */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${dotSize} rounded-full bg-accent border-2 border-surface shadow-sm`}
          style={{ left: `${dotPct}%` }}
        />
      </div>
      {isFull && (
        <div className="mt-1.5 flex justify-between text-caption text-mute dark:text-mute font-medium">
          <span>p10 {p10Min}분</span>
          <span>중앙값 {p50Min}분</span>
          <span>p90 {p90Min}분</span>
        </div>
      )}
    </div>
  )
}
