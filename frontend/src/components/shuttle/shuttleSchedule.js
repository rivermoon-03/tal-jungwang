/**
 * 셔틀 시간표 표시용 순수 헬퍼.
 *
 * ShuttleTimetable 컴포넌트와 ScheduleDetailModal의 ShuttleContent가 같은 규칙을
 * 쓰도록 한곳에 모은다. 컴포넌트 파일에서 분리해야 fast refresh가 동작한다.
 */

// direction 코드(CLAUDE.md 도메인 용어) → 표시 라벨.
export const DIRECTION_LABELS = { 0: '등교', 1: '하교', 2: '제2캠퍼스 등교', 3: '제2캠퍼스 하교' }


function toMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

// note === '수시운행'인 연속 항목을 하나의 밴드로 묶어 display 목록을 생성.
// ScheduleDetailModal의 ShuttleContent도 좁은 폰 스트립을 만들 때 이 함수를
// 그대로 재사용한다(수시운행 밴드 묶기 로직 중복 방지).
export function buildDisplayList(times) {
  const result = []
  let i = 0
  while (i < times.length) {
    if (times[i].note === '수시운행') {
      let j = i
      while (j < times.length && times[j].note === '수시운행') j++
      result.push({
        type: 'frequent',
        key: `frequent-${times[i].depart_at}`,
        startTime: times[i].depart_at,
        endTime: times[j - 1].depart_at,
        startMin: toMinutes(times[i].depart_at),
        endMin: toMinutes(times[j - 1].depart_at),
      })
      i = j
    } else {
      result.push({
        type: 'fixed',
        key: times[i].depart_at,
        time: times[i].depart_at,
        minutes: toMinutes(times[i].depart_at),
        note: times[i].note ?? null,
        variant: times[i].variant ?? null, // seasonal|reduced|normal — 기간 색상 분류
      })
      i++
    }
  }
  return result
}
