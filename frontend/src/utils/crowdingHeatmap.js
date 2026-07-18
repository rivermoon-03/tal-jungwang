// RouteCrowdingSection(F6 요일×시간 혼잡도 히트맵) 전용 표시 로직 헬퍼.
// 반올림/색상 보간처럼 "표시 정책"에 해당하는 로직은 컴포넌트에 인라인하지 않고
// 이 모듈에 모아 단위 테스트로 고정한다(mistakes.md §2 — 인라인 복붙이 회귀의 근원).

import { getKstDayOfWeek } from './timeOfDay'

// 30분 버킷(hour, minute:0|30, crowded, samples) → 시간(0~23) 단위 표본가중 평균.
// 가중치 없이 단순 평균하면 표본이 적은 버킷이 많은 버킷과 동일하게 반영돼 왜곡되므로
// samples를 가중치로 쓴다.
export function mergeToHourly(points) {
  const buckets = Array.from({ length: 24 }, () => ({ weighted: 0, samples: 0 }))
  for (const p of points ?? []) {
    if (p == null || p.hour == null || p.hour < 0 || p.hour > 23) continue
    const samples = p.samples ?? 0
    const b = buckets[p.hour]
    b.weighted += (p.crowded ?? 0) * samples
    b.samples += samples
  }
  return buckets.map((b, hour) => ({
    hour,
    crowded: b.samples > 0 ? b.weighted / b.samples : null,
    samples: b.samples,
  }))
}

// crowded(1.0~4.0) → var(--tj-*) 토큰만으로 만든 배경색.
// ease(여유,초록) → imminent(혼잡,주황) → delayed(매우혼잡,빨강) 2구간 선형보간.
// 하드코딩 hex 없이 CSS 변수 color-mix로만 구성해 다크모드에서 토큰이 자동 전환된다.
export function crowdedToneStyle(crowded) {
  if (crowded == null) {
    return { className: 'bg-surface-2 dark:bg-bg border border-dashed border-line dark:border-line' }
  }
  const clamped = Math.max(1, Math.min(4, crowded))
  const mid = 2.5
  let style
  if (clamped <= mid) {
    const t = (clamped - 1) / (mid - 1)
    style = { backgroundColor: `color-mix(in srgb, var(--tj-imminent) ${Math.round(t * 100)}%, var(--tj-ease) ${Math.round((1 - t) * 100)}%)` }
  } else {
    const t = (clamped - mid) / (4 - mid)
    style = { backgroundColor: `color-mix(in srgb, var(--tj-delayed) ${Math.round(t * 100)}%, var(--tj-imminent) ${Math.round((1 - t) * 100)}%)` }
  }
  return { className: 'border border-line/40 dark:border-line/40', style }
}

export function isWeekendNow(d = new Date()) {
  const dow = getKstDayOfWeek(d)
  return dow === 0 || dow === 6
}
