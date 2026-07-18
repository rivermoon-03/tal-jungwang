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

// ── 학사공지 / 학사일정 (더보기 · "학사공지" 탭) ────────────────────────
// 학과 목록은 거의 바뀌지 않아 폭넓은 interval(1h)로 충분.
export function useSchoolDepartments() {
  return useApi('/school/departments', { interval: 3_600_000 })
}

// department가 정해지기 전(목록 로딩 중)에는 fetch하지 않는다 — enabled로 제어.
export function useSchoolNotices(department) {
  return useApi(department ? `/school/notices?department=${department}` : '/school/notices', {
    interval: 300_000,
    enabled: !!department,
  })
}

export function useAcademicCalendar() {
  return useApi('/school/calendar', { interval: 3_600_000 })
}
