/**
 * LibrarySection — 학교시설 · 도서관 탭 본문(모바일·PC 공용).
 *
 * 시험이 가까우면 LibraryPanel 이 D-day 칩과 강조 보더를 단다 — 시험기간 전용
 * 화면을 따로 만들지 않고 같은 카드가 상태만 바꾼다.
 */
import EmptyState from '../ui/EmptyState'
import LibraryPanel from './LibraryPanel'
import { useAcademicCalendar, useLibraryHours } from '../../hooks/useMore'
import { findExamEvent, summarizeLibraryHours } from '../../utils/homeBriefing'

export default function LibrarySection() {
  const libraryQuery = useLibraryHours()
  const calendarQuery = useAcademicCalendar()

  const rooms = Array.isArray(libraryQuery.data) ? libraryQuery.data : []
  const summary = summarizeLibraryHours(rooms)
  const exam = findExamEvent(
    [calendarQuery.data?.next, ...(calendarQuery.data?.upcoming ?? [])].filter(Boolean)
  )

  if (libraryQuery.loading && rooms.length === 0) {
    return <div className="h-40 rounded-card bg-surface-2 animate-pulse" />
  }
  if (rooms.length === 0) {
    return (
      <EmptyState
        title="열람실 정보를 불러오지 못했어요"
        desc="잠시 후 다시 확인해 주세요."
        action={{ label: '다시 확인', onClick: libraryQuery.refetch }}
      />
    )
  }
  return <LibraryPanel rooms={rooms} summary={summary} exam={exam} />
}
