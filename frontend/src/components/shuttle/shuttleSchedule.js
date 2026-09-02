/**
 * 셔틀 시간표 표시용 순수 헬퍼.
 *
 * ShuttleTimetable 컴포넌트와 ScheduleDetailModal의 ShuttleContent가 같은 규칙을
 * 쓰도록 한곳에 모은다. 컴포넌트 파일에서 분리해야 fast refresh가 동작한다.
 */
import { groupItemsByHour } from '../schedule/timetableGroups'

// direction 코드(CLAUDE.md 도메인 용어) → 표시 라벨.
export const DIRECTION_LABELS = { 0: '등교', 1: '하교', 2: '제2캠퍼스 등교', 3: '제2캠퍼스 하교' }


function toMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

/**
 * annotateShuttleEntries(entries, nowStr) — 원시 시간표(entries: 문자열 또는
 * {depart_at, note, variant} 객체 배열, HH:MM 오름차순 가정)를 화면 주석
 * (과거/다음/막차)까지 붙인 평평한 목록으로 만든다.
 *
 * "지금" 기준 과거 그룹도 흐리게 보여주는 시안 규격 때문에, 기존
 * ShuttleContent의 future/past 분리(과거는 최근 2개만 노출) 대신 하루 전체를
 * 한 번에 그리는 buildShuttleGroups()의 입력으로 쓴다.
 *
 * @param {Array<string|{depart_at:string, note?:string, variant?:string}>} entries
 * @param {string} nowStr - "HH:MM"
 * @returns {Array<{key,time,note,variant,isPast,isNext,isLast}>}
 */
export function annotateShuttleEntries(entries, nowStr) {
  let nextFound = false
  return entries.map((e, i) => {
    const time = (typeof e === 'string' ? e : e?.depart_at ?? '').slice(0, 5)
    const note = typeof e === 'object' ? e?.note ?? null : null
    const variant = typeof e === 'object' ? e?.variant ?? null : null
    const isPast = time < nowStr
    let isNext = false
    if (!isPast && !nextFound) {
      isNext = true
      nextFound = true
    }
    return { key: `${time}-${i}`, time, note, variant, isPast, isNext, isLast: i === entries.length - 1 }
  })
}

/**
 * buildShuttleGroups(entries) — annotateShuttleEntries() 결과를 시(hour) 그룹 /
 * 수시운행 블록 / 회차편 블록의 순서 있는 목록으로 나눈다.
 *
 * note 필드('수시운행', '회차편 ...')로 연속 구간을 식별해 그 구간만 특수
 * 블록으로 빼고, 나머지는 평범한 시(hour) 그룹(groupItemsByHour)으로 묶는다 —
 * 등교 08:40~10:00 수시운행, 17시 이후 회차편이 이 규칙에 해당한다.
 *
 * @param {Array<{key,time,note,variant,isPast,isNext,isLast}>} entries
 * @returns {Array<{type:'hour', hour, items} | {type:'frequent'|'return', key, items}>}
 */
export function buildShuttleGroups(entries) {
  const groups = []
  let i = 0
  while (i < entries.length) {
    const e = entries[i]
    if (e.note === '수시운행') {
      let j = i
      while (j < entries.length && entries[j].note === '수시운행') j++
      groups.push({ type: 'frequent', key: `frequent-${e.time}`, items: entries.slice(i, j) })
      i = j
    } else if (e.note?.startsWith('회차편')) {
      let j = i
      while (j < entries.length && entries[j].note?.startsWith('회차편')) j++
      groups.push({ type: 'return', key: `return-${e.time}`, items: entries.slice(i, j) })
      i = j
    } else {
      let j = i
      while (j < entries.length && entries[j].note !== '수시운행' && !entries[j].note?.startsWith('회차편')) j++
      for (const g of groupItemsByHour(entries.slice(i, j))) {
        groups.push({ type: 'hour', key: `hour-${g.hour}`, hour: g.hour, items: g.items })
      }
      i = j
    }
  }
  return groups
}

/**
 * parseReturnNote(note) — "회차편 · 학교 HH:MM 출발" / "회차편 · 학교 수시운행 출발"
 * 에서 원편(하교) 출발 시각을 뽑는다. 하교 출발이 수시운행 중이면 시각이
 * 정해지지 않으므로 isFrequentReturn만 true이고 originTime은 null.
 *
 * @param {string|null} note
 * @returns {{ isFrequentReturn: boolean, originTime: string|null }}
 */
export function parseReturnNote(note) {
  const isFrequentReturn = !!note?.includes?.('수시운행')
  const match = !isFrequentReturn ? note?.match?.(/(\d{2}:\d{2})/) : null
  return { isFrequentReturn, originTime: match ? match[1] : null }
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
