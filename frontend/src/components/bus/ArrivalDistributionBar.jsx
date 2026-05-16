// p10/p50/p90 분 단위 분포 바.
// variant='mini'  — 8px, 카드 하단용, 라벨 없음
// variant='full'  — 14px + p10/중앙값/p90 라벨, 시트 헤더용
// maxMin 기본 20분, p90이 그보다 크면 자동 확장.
export default function ArrivalDistributionBar({
  p10Min,
  p50Min,
  p90Min,
  variant = 'mini',
  maxMin: maxMinProp,
}) {
  if (p10Min == null || p50Min == null || p90Min == null) return null

  const maxMin = Math.max(maxMinProp ?? 20, p90Min + 1)
  const left = (p10Min / maxMin) * 100
  const width = Math.max(((p90Min - p10Min) / maxMin) * 100, 1.5)
  const dot = (p50Min / maxMin) * 100

  const isFull = variant === 'full'
  const barHeight = isFull ? 'h-3.5' : 'h-2'
  const dotSize = isFull ? 'w-3 h-3' : 'w-2.5 h-2.5'

  return (
    <div className="w-full">
      <div className={`relative w-full ${barHeight} rounded-full bg-slate-100 dark:bg-surface-dark-alt overflow-hidden`}>
        <div
          className={`absolute top-0 bottom-0 ${isFull ? 'bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20' : 'bg-accent/30'} rounded-full`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 ${dotSize} rounded-full bg-accent border-2 border-white dark:border-surface-dark shadow-sm`}
          style={{ left: `${dot}%` }}
        />
      </div>
      {isFull && (
        <div className="mt-1.5 flex justify-between text-[10px] text-mute dark:text-mute-dark font-medium">
          <span>p10 {p10Min}분</span>
          <span>중앙값 {p50Min}분</span>
          <span>p90 {p90Min}분</span>
        </div>
      )}
    </div>
  )
}
