// 마지막 API 응답을 localStorage 에 남겨, 다음에 앱을 열 때 네트워크를 기다리지 않고 그린다.
// 남은 초가 들어 있는 실시간 응답은 오래되면 틀린 숫자가 되므로 경로마다 보관 한도를 둔다.
const PREFIX = 'tj-api:'
const MIN = 60_000

const MAX_AGE = [
  ['/bus/arrivals/', 3 * MIN],
  ['/subway/next', 3 * MIN],
  ['/subway/realtime', 2 * MIN],
  ['/shuttle/next', 3 * MIN],
  ['/weather/current', 60 * MIN],
  ['/cafeteria/menu', 12 * 60 * MIN],
  ['/subway/timetable', 12 * 60 * MIN],
  ['/shuttle/schedule', 6 * 60 * MIN],
  ['/bus/timetable-by-route/', 12 * 60 * MIN],
]

export function maxAgeOf(path) {
  return MAX_AGE.find(([prefix]) => path?.startsWith(prefix))?.[1] ?? 0
}

/** 보관 한도 안의 응답만 돌려준다. 없거나 오래됐으면 null */
export function readPersisted(path, now = Date.now()) {
  const maxAge = maxAgeOf(path)
  if (!maxAge) return null
  try {
    const raw = localStorage.getItem(PREFIX + path)
    if (!raw) return null
    const v = JSON.parse(raw)
    if (typeof v?.fetchedAt !== 'number' || now - v.fetchedAt > maxAge) return null
    return v
  } catch {
    return null
  }
}

export function writePersisted(path, data, fetchedAt) {
  if (!maxAgeOf(path)) return
  try {
    localStorage.setItem(PREFIX + path, JSON.stringify({ data, fetchedAt }))
  } catch {
    // 저장 공간이 없거나 막힌 브라우저면 보관만 건너뛴다.
  }
}
