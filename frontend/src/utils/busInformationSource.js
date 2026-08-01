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
