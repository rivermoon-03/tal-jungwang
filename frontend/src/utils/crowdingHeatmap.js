// RouteCrowdingSection(F6 요일×시간 혼잡도 히트맵) 전용 표시 로직 헬퍼.
// 반올림/색상 보간처럼 "표시 정책"에 해당하는 로직은 컴포넌트에 인라인하지 않고
// 이 모듈에 모아 단위 테스트로 고정한다(mistakes.md §2 — 인라인 복붙이 회귀의 근원).

import { getKstDayOfWeek } from './timeOfDay'
import { RATIO_THRESHOLDS } from './crowdingLevel'

// 30분 버킷 → 시간(0~23) 단위 표본가중 집계.
// 값은 평균(crowded)이 아니라 혼잡 비율(ratio)이다 — 평균은 하한이 1이라 값 1인 버스와
// 3인 버스가 섞이면 2("보통")로 뭉개진다(crowdingSummary.js 주석 참고).
// 표본이 적은 버킷이 많은 버킷과 동일하게 반영되지 않도록 samples를 가중치로 쓴다.
export function mergeToHourly(points) {
  const buckets = Array.from({ length: 24 }, () => ({
    weighted: 0, samples: 0, estimated: false, reliable: false,
  }))
  for (const p of points ?? []) {
    if (p == null || p.hour == null || p.hour < 0 || p.hour > 23) continue
    if (p.ratio == null) continue
    const samples = p.samples ?? 0
    if (samples <= 0) continue
    const b = buckets[p.hour]
    b.weighted += p.ratio * samples
    b.samples += samples
    if (p.estimated) b.estimated = true
    if (p.reliable !== false) b.reliable = true
  }
  return buckets.map((b, hour) => ({
    hour,
    ratio: b.samples > 0 ? b.weighted / b.samples : null,
    samples: b.samples,
    estimated: b.estimated,
    reliable: b.samples > 0 ? b.reliable : true,
  }))
}

// 혼잡 비율(0~1) → var(--tj-*) 토큰만으로 만든 배경색.
// ease(여유) → imminent(붐빔) → delayed(매우 붐빔) 2구간 선형보간. 구간 경계는
// crowdingLevel의 라벨 임계와 맞춘다 — 색과 글자가 다른 말을 하면 안 된다.
// 하드코딩 hex 없이 CSS 변수 color-mix로만 구성해 다크모드에서 토큰이 자동 전환된다.
export function crowdedToneStyle(ratio) {
  if (ratio == null || Number.isNaN(ratio)) {
    return { className: 'bg-surface-2 dark:bg-bg border border-dashed border-line dark:border-line' }
  }
  const clamped = Math.max(0, Math.min(1, ratio))
  const mid = RATIO_THRESHOLDS.busy
  let style
  if (clamped <= mid) {
    const t = clamped / mid
    style = { backgroundColor: `color-mix(in srgb, var(--tj-imminent) ${Math.round(t * 100)}%, var(--tj-ease) ${Math.round((1 - t) * 100)}%)` }
  } else {
    const t = Math.min(1, (clamped - mid) / (RATIO_THRESHOLDS.veryBusy - mid))
    style = { backgroundColor: `color-mix(in srgb, var(--tj-delayed) ${Math.round(t * 100)}%, var(--tj-imminent) ${Math.round((1 - t) * 100)}%)` }
  }
  return { className: 'border border-line/40 dark:border-line/40', style }
}

export function isWeekendNow(d = new Date()) {
  const dow = getKstDayOfWeek(d)
  return dow === 0 || dow === 6
}
