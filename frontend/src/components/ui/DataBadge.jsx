/**
 * DataBadge — 실시간 / 시간표 / 지연(stale) 데이터 상태를 표시하는 공용 배지.
 *
 * 화면마다 제각각이던 표기(펄스 점만, 텍스트만, 일부 화면엔 stale 표기 누락)를
 * 이 컴포넌트 하나로 일원화한다. StatusChip과 같은 스케일(rounded-full 배지,
 * text-micro)을 쓰되, "데이터 신선도" 전용 3상태(live/timetable/stale)에 집중한다.
 * kind가 임의 의미색인 StatusChip과 역할이 겹치지 않도록, 기존 StatusChip
 * 사용처(막차/베타/혼잡도 등)는 그대로 두고 이 컴포넌트로 옮기지 않는다.
 *
 * state:
 *   live      → accent 배경 + pulse 점, 라벨 "실시간"
 *   timetable → chip-gray 배경(뉴트럴), 라벨 "시간표"
 *   stale     → imminent 계열 배경, 라벨 staleAgeText(있으면) 또는 "지연 갱신"
 *
 * compact: 지도 마커 칩처럼 공간이 좁은 곳에서 라벨 없이 점만 보여준다.
 *          시각적 라벨은 생략하되 sr-only 텍스트로 접근성 라벨은 유지한다.
 *
 * pulse 애니메이션은 StatusChip의 실시간 점과 동일한 `animate-dot-blink`
 * (tailwind.config.js)를 재사용한다. 인라인 style로 애니메이션을 걸지 않으므로
 * index.css의 전역 `prefers-reduced-motion` 규칙(모든 애니메이션 duration을
 * 0.01ms로 강제)이 그대로 적용된다.
 */

const STATE_META = {
  live: {
    label: '실시간',
    badgeClass: 'bg-accent-bg dark:bg-accent-bg text-accent-ink dark:text-accent-ink',
    dotClass: 'bg-accent-ink dark:bg-accent-ink',
    pulse: true,
  },
  timetable: {
    label: '시간표',
    badgeClass: 'bg-chip-gray-bg dark:bg-chip-gray-bg text-chip-gray-fg dark:text-chip-gray-fg',
    dotClass: 'bg-chip-gray-fg dark:bg-chip-gray-fg',
    pulse: false,
  },
  stale: {
    label: '지연 갱신',
    badgeClass: 'bg-imminent-bg dark:bg-imminent-bg text-imminent dark:text-imminent',
    dotClass: 'bg-imminent dark:bg-imminent',
    pulse: false,
  },
}

export default function DataBadge({ state = 'timetable', staleAgeText = null, compact = false, className = '' }) {
  const meta = STATE_META[state] ?? STATE_META.timetable
  const label = state === 'stale' && staleAgeText ? staleAgeText : meta.label

  if (compact) {
    return (
      <span className={['inline-flex items-center', className].filter(Boolean).join(' ')}>
        <span
          aria-hidden="true"
          className={[
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            meta.dotClass,
            meta.pulse ? 'animate-dot-blink' : '',
          ].filter(Boolean).join(' ')}
        />
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold leading-none select-none whitespace-nowrap',
        meta.badgeClass,
        className,
      ].filter(Boolean).join(' ')}
    >
      {meta.pulse && (
        <span
          aria-hidden="true"
          className={['w-1.5 h-1.5 rounded-full flex-shrink-0 animate-dot-blink', meta.dotClass].join(' ')}
        />
      )}
      {label}
    </span>
  )
}
