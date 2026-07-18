/**
 * 정왕풍(定王風) — 정왕동 특유의 건물풍을 재치있게 부르는 로컬 표현.
 *
 * 풍속(m/s) 하나를 받아 히어로에 표시할 조각들을 만든다:
 *   { value: '3.4m/s', phrase: '살랑이는 바람', strong: false }
 *
 * 표시 로직(반올림·문구 매핑)을 이 한 곳에 모아 컴포넌트에서 인라인 분기하지 않는다
 * (mistakes.md #2). 컴포넌트는 라벨('정왕풍')과 조합만 담당.
 *
 * 기상청 WSD가 없으면 speed는 null → describeJeongwangWind는 null을 반환하고
 * 컴포넌트는 바람 줄을 렌더하지 않는다.
 *
 * 세기 구간(기상청 육상 풍속 체감 + 정왕풍 밈 톤):
 *   < 2      잔잔한 바람
 *   2 – 4    살랑이는 바람
 *   4 – 6    선선한 바람
 *   6 – 9    제법 부는 바람   (strong)
 *   9 – 12   쌩쌩 부는 정왕풍  (strong)
 *   >= 12    몸이 날아갈 듯한 정왕풍 (strong)
 */

/** @returns {{value: string, phrase: string, strong: boolean} | null} */
export function describeJeongwangWind(speed) {
  if (speed == null || Number.isNaN(speed) || speed < 0) return null

  // 3.0 → "3", 3.4 → "3.4" (JS Number가 후행 0을 자동 제거)
  const value = `${Math.round(speed * 10) / 10}m/s`

  let phrase
  let strong = false
  if (speed < 2) phrase = '잔잔한 바람'
  else if (speed < 4) phrase = '살랑이는 바람'
  else if (speed < 6) phrase = '선선한 바람'
  else if (speed < 9) { phrase = '제법 부는 바람'; strong = true }
  else if (speed < 12) { phrase = '쌩쌩 부는 정왕풍'; strong = true }
  else { phrase = '몸이 날아갈 듯한 정왕풍'; strong = true }

  return { value, phrase, strong }
}
