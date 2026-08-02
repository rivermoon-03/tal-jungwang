import { useApi } from './useApi'

export function useNotices() {
  return useApi('/more/notices', { interval: 300_000 })
}

export function useLinks() {
  return useApi('/more/links', { interval: 3_600_000 })
}

export function useAppInfo() {
  return useApi('/more/info', { interval: 3_600_000 })
}

// ── 학교 공지 / 학사일정 (더보기 · "학사공지" 탭) ───────────────────────
// DS1(2026-08): 학과 공지(RSS)를 제거하고 전교 게시판 카테고리로 대체.
// category: 'all' | 'academic' | 'scholarship' | 'job' | 'extra' | 'dorm'
export function useSchoolBoardNotices(category = 'all') {
  return useApi(`/school/board-notices?category=${category}`, { interval: 300_000 })
}

export function useAcademicCalendar() {
  return useApi('/school/calendar', { interval: 3_600_000 })
}

// F7 — 도서관 열람실 개관시간(시험기간 카드). 방학/학기 전환 때나 바뀌므로 폴링 없음.
export function useLibraryHours(opts = {}) {
  return useApi('/school/library-hours', { ttl: 6 * 60 * 60 * 1000, ...opts })
}
