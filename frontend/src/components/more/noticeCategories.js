/**
 * noticeCategories — 학교 공지 카테고리(DS1) 단일 출처.
 * 백엔드 BOARD_SOURCES(tukorea_boards.py)의 category 코드와 1:1이다.
 * 학과 공지(RSS)는 2026-08 개편에서 제거됐다.
 */
export const NOTICE_CATEGORIES = [
  { id: 'all', label: '전체' },
  { id: 'academic', label: '학사' },
  { id: 'scholarship', label: '장학' },
  { id: 'job', label: '취업' },
  { id: 'extra', label: '비교과' },
  { id: 'dorm', label: '생활관' },
]

// 카테고리 뱃지 색 — DESIGN.md 카테고리 칩 팔레트(soft tinted)만 사용.
const CATEGORY_CHIP_CLASS = {
  academic: 'bg-chip-blue-bg text-chip-blue-fg',
  scholarship: 'bg-chip-yellow-bg text-chip-yellow-fg',
  job: 'bg-chip-green-bg text-chip-green-fg',
  extra: 'bg-chip-purple-bg text-chip-purple-fg',
  dorm: 'bg-chip-gray-bg text-chip-gray-fg',
}

export function categoryChipClass(category) {
  return CATEGORY_CHIP_CLASS[category] ?? 'bg-chip-gray-bg text-chip-gray-fg'
}
