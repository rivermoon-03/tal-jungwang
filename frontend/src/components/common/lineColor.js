/**
 * 노선별 색상 매핑 (단일 소스).
 * 디자인 번들 tokens.css의 --line-* 변수를 노선명 → CSS var()로 변환한다.
 */

const TJ_LINE_COLOR = {
  '20-1':     'var(--line-201)',
  '시흥33':   'var(--line-33)',
  '시흥1':    'var(--line-33)',
  '11-A':     'var(--line-33)',
  '99-2':     'var(--line-33)',
  '3400':     'var(--line-express)',
  '3401':     'var(--line-express)',
  '6502':     'var(--line-express)',
  '5602':     'var(--line-201)',
  '4호선':    'var(--line-4)',
  '수인분당': 'var(--line-suin)',
  '서해선':   'var(--line-seohae)',
  '등교셔틀': 'var(--line-shuttle)',
  '하교셔틀': 'var(--line-shuttle)',
  '셔틀':     'var(--line-shuttle)',
}

export function tjLineColor(route) {
  if (!route) return 'var(--tj-accent)'
  if (TJ_LINE_COLOR[route]) return TJ_LINE_COLOR[route]
  for (const key of Object.keys(TJ_LINE_COLOR)) {
    if (route.includes(key)) return TJ_LINE_COLOR[key]
  }
  return 'var(--tj-accent)'
}
