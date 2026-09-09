/**
 * 목록 카드 왼쪽 시간열에 사용할 대표 source를 고른다.
 *
 * - 같은 정류장의 시간표/실시간은 지금 탈 수 있는지를 보여주는 실시간 우선
 * - 서로 다른 정류장이면 실제 승차 기점의 시간표 우선
 * - 한 유형만 있으면 서버 sort_order 순서의 첫 source 사용
 */
export function selectRepresentativeBusSource(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return null

  const ordered = [...sources].sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0))
  const timetables = ordered.filter((source) => source.type === 'timetable')
  const realtime = ordered.filter((source) => source.type === 'realtime')

  if (timetables.length && realtime.length) {
    const realtimeAtTimetableStop = realtime.find((live) =>
      timetables.some((table) => table.stop_id === live.stop_id),
    )
    return realtimeAtTimetableStop ?? timetables[0]
  }

  return ordered[0]
}

/**
 * 승차 지점 단위로 묶어 지점마다 대표 source 하나만 남긴다.
 *
 * 카드 하단 출처 줄은 "어느 정류장에서 언제 탈 수 있나" 를 말하는 자리다.
 * 지점 하나에 시간표와 실시간이 함께 등록돼 있으면(3400 시흥터미널) 같은
 * 정류장 이름이 두 줄로 나오고, 두 줄이 같은 차를 각각 다른 시각으로 말한다.
 * 한 지점은 한 줄이고, 그 줄이 쓰는 값의 출처를 칩이 밝힌다.
 *
 * 정렬은 서버가 준 sort_order 를 그대로 따른다 — 어느 지점을 먼저 보여줄지는
 * 데이터가 정한다.
 *
 * @param {Array} sources
 * @returns {Array} 지점당 하나씩, 지점 첫 등장 순서
 */
export function selectSourcesPerStop(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return []

  const ordered = [...sources].sort((a, b) => (a.sort_order ?? a.id ?? 0) - (b.sort_order ?? b.id ?? 0))
  const byStop = new Map()
  for (const source of ordered) {
    const key = source.stop_id ?? source.id
    if (!byStop.has(key)) byStop.set(key, [])
    byStop.get(key).push(source)
  }
  return [...byStop.values()].map((group) => selectRepresentativeBusSource(group))
}
