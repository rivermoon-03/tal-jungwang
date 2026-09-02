/**
 * timetableGroups.js — 시간표 상세 화면(셔틀·지하철)의 시(hour) 그룹 계산 공용 유틸.
 *
 * ScheduleDetailModal의 ShuttleContent/DirectionBlock과 subway/SubwayTimetable.jsx가
 * 같은 "시 그룹 + 지금 앵커" 규칙을 쓰도록 한곳에 모은다 — 표시 로직을 화면마다
 * 복붙하면 임계값·문구가 갈라진다(mistakes.md §2).
 *
 * hour 키는 bus/timetableStats.groupTimesByHour와 동일하게 원본 2자리 문자열을
 * 그대로 쓴다("09시"로 렌더 — 앞자리 0을 떼지 않는다). 화면마다 "9시"/"09시"가
 * 갈리는 걸 막기 위해 기존 관례를 그대로 따른다.
 */
import { createElement } from 'react'
import { formatEta, isImminent } from '../../utils/eta'
import NowAnchorLine from './NowAnchorLine'

// "HH:MM" → 하루 중 분(0~1439). 파싱 실패 시 null.
export function toMinutes(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

/**
 * groupItemsByHour(items) — items: [{ time: 'HH:MM', ... }].
 * 시(hour) 단위로 묶어 시 오름차순으로 정렬한다. 그룹 내부 순서는 입력 순서를 유지한다.
 * @returns {Array<{ hour: string, items: object[] }>}
 */
export function groupItemsByHour(items) {
  if (!Array.isArray(items)) return []
  const order = []
  const groups = new Map()
  for (const item of items) {
    if (toMinutes(item.time) == null) continue
    const hour = item.time.slice(0, 2)
    if (!groups.has(hour)) {
      groups.set(hour, [])
      order.push(hour)
    }
    groups.get(hour).push(item)
  }
  return order
    .slice()
    .sort((a, b) => Number(a) - Number(b))
    .map((hour) => ({ hour, items: groups.get(hour) }))
}

/**
 * anchorLabel(now, nextTime) — "지금" 앵커 알약 문구("지금 HH:MM · 다음 N분").
 * 임박 판정(곧 출발)과 "N분" 라운딩은 utils/eta.js에 위임한다(감사(2026-09) 이후
 * 임박 임계값 단일 출처 — 여기서 새로 만들지 않는다).
 *
 * @param {Date} now
 * @param {string|null} nextTime - 다음 차 출발 시각("HH:MM"). 없으면(오늘 운행 종료) null.
 * @returns {string|null}
 */
export function anchorLabel(now, nextTime) {
  if (!nextTime) return null
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const nowMins = toMinutes(nowStr)
  const targetMins = toMinutes(nextTime)
  if (targetMins == null || nowMins == null) return `지금 ${nowStr}`

  // now(초 단위까지 포함)와 목표 시각의 정밀한 차이를 초로 구해 formatEta에
  // 넘기면, 화면에 보이는 "지금 HH:MM"은 초를 버린 값인데 계산은 초까지 쓴
  // 값이라 어긋난다("19:32에서 19:45까지 13분"인데 "다음 12분"으로 나오는
  // 결함). 화면에 찍히는 두 HH:MM을 그대로 분 단위로 빼면 이 오차가 없다.
  const seconds = (targetMins - nowMins) * 60

  const { text } = formatEta(seconds)
  const nextLabel = isImminent(seconds) ? '곧 출발' : `다음 ${text}`
  return `지금 ${nowStr} · ${nextLabel}`
}

/**
 * findAnchorSplit(groups, nextKey) — "지금" 앵커를 끼울 위치를 계산한다.
 * groups는 { items: [{ key, ... }] } 형태만 있으면 되고(hour/frequent/return
 * 등 그룹 종류를 가리지 않는다), items의 순서는 시간 순이라고 가정한다.
 *
 * 예전에는 "다음" 항목이 속한 그룹 전체 뒤에 무조건 앵커를 넣었다. 다음
 * 항목이 그 그룹의 마지막 항목이 아니면(그룹 중간에 있으면) 다음 항목이
 * 앵커보다 위에 그려져 이미 지나간 차처럼 보이는 결함이 있었다(결함 4).
 * 다음 항목이 그룹의 첫 항목이면(그 앞에 지나간 차가 이 그룹에 없으면)
 * 그룹을 쪼갤 필요가 없으니 그룹 앞(before)에 놓는다. 그 외에는 그룹
 * 안에서 다음 항목 바로 앞(inside)에 놓는다.
 *
 * @param {Array<{ items: Array<{ key }> }>} groups
 * @param {string|null} nextKey - "다음" 항목의 key. 없으면(오늘 운행 종료) null.
 * @returns {null | { groupIndex: number, insideAfterIndex: number | null }}
 *   insideAfterIndex가 null이면 그룹 앞에, 숫자면 그 그룹의 items[insideAfterIndex]
 *   바로 뒤(= 다음 항목 바로 앞)에 앵커를 놓으라는 뜻이다.
 */
export function findAnchorSplit(groups, nextKey) {
  if (!nextKey || !Array.isArray(groups)) return null
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const idx = groups[groupIndex].items.findIndex((it) => it.key === nextKey)
    if (idx === -1) continue
    return idx === 0
      ? { groupIndex, insideAfterIndex: null }
      : { groupIndex, insideAfterIndex: idx - 1 }
  }
  return null
}

/**
 * insertAnchorLine(items, anchorAfterIndex, label, renderItem) — items를
 * renderItem으로 렌더한 칩 배열 중간에 "지금" 앵커를 끼워 넣는 공용 헬퍼.
 *
 * HourGroupBlock(시 그룹)뿐 아니라 shuttle/ShuttleTimetableGroups의
 * frequent(수시운행 묶음)/return(회차편) 그룹도 "다음 항목이 그룹 중간에
 * 있을 수 있다"는 같은 문제를 겪는다(결함 4) — 칩 하나를 만드는 방법만
 * 그룹 종류마다 다르게 넘기고, 앵커를 끼우는 위치 계산은 여기서 공유한다.
 * anchorAfterIndex가 null이면 이 그룹 안에는 앵커를 넣지 않는다(그룹 앞에
 * 놓는 경우는 호출부가 그룹 바깥에서 처리한다).
 *
 * 이 파일은 컴포넌트를 export하지 않는 순수 로직 파일이라 JSX 없이
 * createElement로 NowAnchorLine을 만든다 — 컴포넌트 파일(.jsx)에 이 함수를
 * 두면 react-refresh/only-export-components(Fast Refresh)를 어긴다.
 *
 * @param {object[]} items
 * @param {number|null} anchorAfterIndex - 이 인덱스 항목 바로 뒤에 앵커를 놓는다.
 * @param {string|null} label - NowAnchorLine 알약 문구.
 * @param {(item: object, index: number) => React.ReactNode} renderItem
 */
export function insertAnchorLine(items, anchorAfterIndex, label, renderItem) {
  return items.flatMap((it, idx) => {
    const node = renderItem(it, idx)
    if (anchorAfterIndex === idx) {
      return [node, createElement(NowAnchorLine, { key: `${it.key}-anchor`, label, className: 'w-full' })]
    }
    return [node]
  })
}
