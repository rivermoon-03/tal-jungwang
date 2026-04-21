// 혼잡도(1.0~4.0) → 색상 보간.
// 어두운 슬레이트 배경 대비 가독성을 우선한 신호등 톤.
// 1=여유(emerald-400), 2=보통(amber-300), 3=혼잡(orange-400), 4=매우혼잡(red-400)
const STOPS = [
  { at: 1, rgb: [52, 211, 153] },  // emerald-400 #34d399
  { at: 2, rgb: [252, 211, 77] },  // amber-300   #fcd34d
  { at: 3, rgb: [251, 146, 60] },  // orange-400  #fb923c
  { at: 4, rgb: [248, 113, 113] }, // red-400     #f87171
]

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))
}

export function crowdedColor(v) {
  if (v == null || Number.isNaN(v)) return 'rgb(148,163,184)' // slate-400
  const clamped = Math.max(1, Math.min(4, v))
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]
    const b = STOPS[i + 1]
    if (clamped >= a.at && clamped <= b.at) {
      const t = (clamped - a.at) / (b.at - a.at)
      const rgb = mix(a.rgb, b.rgb, t)
      return `rgb(${rgb.join(',')})`
    }
  }
  return `rgb(${STOPS[STOPS.length - 1].rgb.join(',')})`
}

export function crowdedLabel(v) {
  if (v == null) return '정보없음'
  if (v < 1.35) return '여유'
  if (v < 2.5) return '보통'
  if (v < 3.5) return '혼잡'
  return '매우혼잡'
}

// 노선별 포인트 컬러 — 탭 인디케이터와 상단 halo에만 쓴다.
// 카드 배경은 4개 노선이 공유하는 중성 슬레이트라 막대 색과 충돌하지 않는다.
export const ROUTE_ACCENTS = {
  '시흥33': '#38bdf8', // sky-400
  '20-1':   '#a78bfa', // violet-400
  '시흥1':  '#f472b6', // pink-400
  '11-A':   '#facc15', // yellow-400
}
