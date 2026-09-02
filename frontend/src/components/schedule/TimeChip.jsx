/**
 * TimeChip — 시간표 상세 시(hour) 그룹 안에서 쓰는 출발 시각 칩.
 *
 * 규격(시안): 최소 폭 52px · 높이 38px 이상. 터치 타깃 44px 확보를 위해 최소
 * 높이는 44px로 잡는다(38px 규격을 상회하므로 시안과 충돌하지 않는다).
 * rounded-tile · tabular-nums. 지난 시각은 opacity로만 흐리게 하고(배경을 없애지
 * 않음 — DESIGN.md "색만으로 강조"), 다음 한 대만 accent 배경에 흰 글자로 채운다.
 *
 * sub는 선택적 보조 캡션 한 줄(지하철 행선지 "오이도", 셔틀 회차편 원편 시각
 * "학교 18:00 출발" 등) — 12px 미만 폰트 금지 정책 때문에 정확히 12px로 고정한다.
 */
export default function TimeChip({ time, sub = null, isPast = false, isNext = false, lastBadge = false, chipRef }) {
  return (
    <span
      ref={chipRef}
      className={[
        'relative inline-flex flex-col items-center justify-center min-w-[52px] min-h-[44px] px-2 py-1',
        'rounded-tile tabular-nums tracking-tight transition-colors',
        isNext
          ? 'bg-accent dark:bg-accent text-white dark:text-ink'
          : 'bg-surface-2 dark:bg-bg text-ink dark:text-ink',
        isPast ? 'opacity-40' : '',
      ].filter(Boolean).join(' ')}
    >
      <span className="text-label font-bold leading-none">{time}</span>
      {sub && (
        <span
          className={`text-chip font-semibold leading-tight mt-0.5 text-center break-keep ${
            isNext ? 'text-white/85 dark:text-ink/70' : 'text-mute dark:text-mute'
          }`}
        >
          {sub}
        </span>
      )}
      {lastBadge && (
        <span
          aria-hidden
          className="absolute -top-1.5 -right-1 text-micro font-bold px-1 rounded-pill bg-ink dark:bg-line-strong text-white dark:text-ink leading-tight"
        >
          막차
        </span>
      )}
    </span>
  )
}
