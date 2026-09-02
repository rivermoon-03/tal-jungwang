/**
 * noticeReadState — 공지 안읽음 표시를 위한 카테고리별 "마지막으로 확인한 id" 저장소.
 *
 * 계정 시스템이 없어 읽음 상태를 서버에 둘 수 없다. 기기 로컬(localStorage)에
 * 카테고리별 마지막 확인 id만 남겨, "그 id보다 큰 항목 = 안읽음"으로 판정한다.
 * id는 DB PK(자동 증가)라서 "더 큰 id = 더 최근 수집"이 항상 성립한다 —
 * published_at 문자열 비교보다 안정적이다.
 *
 * category는 호출부가 정하는 임의 문자열 키다(예: 'app', 학교 공지는 실제
 * n.category 값인 'academic'/'scholarship' 등을 그대로 쓴다) — 카테고리마다
 * 독립적으로 안읽음을 추적해야 필터를 바꿔도 다른 카테고리의 읽음 상태가
 * 섞이지 않는다.
 */
const STORAGE_PREFIX = 'tj:notices:lastSeen:'

function readLastSeenId(category) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${category}`)
    if (!raw) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  } catch {
    // localStorage가 막힌 환경(프라이빗 모드 등)에서도 화면이 죽지 않게 한다 —
    // 이 경우 매번 "처음 방문"으로 취급해 전부 안읽음으로 보인다.
    return null
  }
}

function writeLastSeenId(category, id) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${category}`, String(id))
  } catch {
    // 저장 실패해도 다음에도 안읽음으로 보이는 것 말고는 부작용이 없다.
  }
}

/**
 * id가 마지막으로 확인한 id보다 크면(더 최신이면) true.
 * 처음 방문(저장된 값 없음)이면 전부 안읽음으로 본다.
 */
export function isNoticeUnread(category, id) {
  if (id == null || !category) return false
  const lastSeen = readLastSeenId(category)
  if (lastSeen == null) return true
  return Number(id) > lastSeen
}

/**
 * ids 중 가장 큰 값을 그 카테고리의 "마지막 확인"으로 기록한다.
 * 이미 기록된 값보다 작거나 같으면(예: 필터링으로 일부만 넘어온 경우) 건너뛴다 —
 * 마지막 확인 id는 시간이 지나도 뒤로 가지 않는다.
 */
export function markNoticesSeen(category, ids) {
  if (!category || !Array.isArray(ids) || ids.length === 0) return
  const numericIds = ids.map(Number).filter(Number.isFinite)
  if (numericIds.length === 0) return
  const maxId = Math.max(...numericIds)
  const prev = readLastSeenId(category)
  if (prev != null && maxId <= prev) return
  writeLastSeenId(category, maxId)
}

/**
 * notices 배열을 각 항목의 category 필드로 묶어 한 번에 markNoticesSeen을 호출한다.
 * 학교 공지처럼 한 목록에 여러 카테고리가 섞여 내려오는 경우(category=all) 쓴다.
 */
export function markNoticesSeenByOwnCategory(notices) {
  if (!Array.isArray(notices)) return
  const idsByCategory = new Map()
  for (const n of notices) {
    if (!n?.category || n.id == null) continue
    const list = idsByCategory.get(n.category) ?? []
    list.push(n.id)
    idsByCategory.set(n.category, list)
  }
  for (const [category, ids] of idsByCategory) {
    markNoticesSeen(category, ids)
  }
}
