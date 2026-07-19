/**
 * nextShuttleBus.js — 셔틀 "오늘 운행 종료" 빈 상태에서 쓰는 표시 헬퍼.
 *
 * 등교/하교 두 방향의 내일 첫차("HH:MM")를 받아, 더 이른 시각을 대표값으로
 * 뽑고 두 방향 모두를 보조 문구로 함께 보여준다. 시각 대소 비교는 문자열
 * 사전순이 아니라 분 단위 정수 비교로 한다(CLAUDE.md §3-2).
 */

function toMinutes(hhmm) {
  // 빈 문자열/null을 그대로 split하면 Number('')가 0으로 캐스팅돼 "자정(0분)"으로
  // 잘못 해석될 수 있다 — 콜론 포함 문자열인지 먼저 확인한다.
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * @param {string|null} goFirst   등교 방향 내일 첫차 "HH:MM"
 * @param {string|null} backFirst 하교 방향 내일 첫차 "HH:MM"
 * @returns {{ time: string, sub: string } | null} 둘 다 없으면 null
 */
export function getNextShuttleBusInfo(goFirst, backFirst) {
  if (!goFirst && !backFirst) return null

  const goMin = toMinutes(goFirst)
  const backMin = toMinutes(backFirst)
  const earliest =
    goMin == null ? backFirst
    : backMin == null ? goFirst
    : goMin <= backMin ? goFirst : backFirst

  return {
    time: earliest,
    sub: `등교 ${goFirst ?? '-'} · 하교 ${backFirst ?? '-'}`,
  }
}
