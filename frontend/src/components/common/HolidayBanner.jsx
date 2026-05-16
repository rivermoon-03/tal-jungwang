/**
 * HolidayBanner
 * ─────────────────────────────────────────────────────────────
 * 백엔드 시간표 응답에 포함된 `is_holiday` / `holiday_name` 메타를 받아
 * 공휴일이면 amber 배너로 "일요일 시간표 적용" 안내를 표시한다.
 *
 * Props:
 *   - isHoliday  : boolean
 *   - holidayName: string | null
 */
export default function HolidayBanner({ isHoliday, holidayName }) {
  if (!isHoliday) return null
  const label = holidayName ? `오늘은 공휴일(${holidayName})` : '오늘은 공휴일'
  return (
    <div
      role="status"
      className="mx-4 mt-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2.5 flex items-start gap-2"
    >
      <span aria-hidden="true" className="text-base leading-none mt-0.5">📅</span>
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
        <span className="font-bold">{label}</span>
        {' — '}
        일요일 시간표가 적용됩니다.
      </p>
    </div>
  )
}
