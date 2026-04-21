// 시간대(0~1439분) → 카드 배경 sky 그라디언트 보간.
// 새벽/아침/한낮/해질녘/밤 키프레임을 이웃 구간끼리 선형 보간한다.

const KF = [
  { t: 0,    top: '#06101e', bottom: '#0d1540' },  // 00:00 deep night
  { t: 300,  top: '#0d1540', bottom: '#1a1b5a' },  // 05:00 pre-dawn indigo
  { t: 360,  top: '#1c0f3f', bottom: '#7c2d12' },  // 06:00 dark violet → burnt orange
  { t: 480,  top: '#7c3500', bottom: '#083344' },  // 08:00 deep amber → ocean teal
  { t: 600,  top: '#083344', bottom: '#0f2d4a' },  // 10:00 deep teal → ocean blue
  { t: 900,  top: '#1e3a8a', bottom: '#0f172a' },  // 15:00 deep navy
  { t: 1020, top: '#78350f', bottom: '#6b1d3a' },  // 17:00 amber → deep rose
  { t: 1080, top: '#92400e', bottom: '#4c0519' },  // 18:00 golden dusk → dark crimson
  { t: 1140, top: '#4c1d95', bottom: '#1e1040' },  // 19:00 violet → dark
  { t: 1260, top: '#0d1540', bottom: '#06101e' },  // 21:00 deep night
  { t: 1440, top: '#06101e', bottom: '#0d1540' },  // 24:00 wrap
]

function parseHex(h) {
  const v = h.replace('#', '')
  return [
    parseInt(v.slice(0, 2), 16),
    parseInt(v.slice(2, 4), 16),
    parseInt(v.slice(4, 6), 16),
  ]
}

function toHex(rgb) {
  return '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function mix(a, b, t) {
  const A = parseHex(a)
  const B = parseHex(b)
  return toHex([0, 1, 2].map((i) => A[i] + (B[i] - A[i]) * t))
}

export function skyPalette(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes()
  for (let i = 0; i < KF.length - 1; i++) {
    const a = KF[i]
    const b = KF[i + 1]
    if (m >= a.t && m <= b.t) {
      const span = b.t - a.t || 1
      const t = (m - a.t) / span
      return {
        top: mix(a.top, b.top, t),
        bottom: mix(a.bottom, b.bottom, t),
      }
    }
  }
  return { top: KF[0].top, bottom: KF[0].bottom }
}

// 배경 위에 놓일 stroke/텍스트용 — 낮에는 어둡게, 밤에는 밝게.
export function isDaytime(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes()
  return m >= 360 && m < 1080 // 06:00 ~ 18:00
}
