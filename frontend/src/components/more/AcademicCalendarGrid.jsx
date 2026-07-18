/**
 * AcademicCalendarGrid — 학사일정 월간 그리드 캘린더.
 *
 * 요일 헤더 + 7열 날짜 그리드. 이벤트(start_date~end_date, 양끝 포함) 범위에
 * 걸리는 날짜엔 점 마커를 표시하고, 날짜를 탭하면 그 날의 이벤트를 아래에 보여준다.
 *
 * 날짜 계산(월 이동/일수/요일/범위 판정)은 전부 utils/academicCalendar.js 헬퍼로
 * 위임한다 — 인라인 Date 파싱/연산 금지(mistakes.md §1·§2).
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  todayKstDateString,
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  isDateInRange,
  formatDateOrRange,
} from '../../utils/academicCalendar'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

export default function AcademicCalendarGrid({ events = [], initialDate = null, now = new Date() }) {
  const today = todayKstDateString(now)
  const startDate = initialDate || today
  const [initY, initM] = startDate.split('-').map(Number)

  const [cursor, setCursor] = useState({ year: initY, month: initM })
  const [selectedDate, setSelectedDate] = useState(startDate)

  const grid = buildMonthGrid(cursor.year, cursor.month)

  function eventsOnDate(dateStr) {
    return events.filter((ev) => isDateInRange(dateStr, ev.start_date, ev.end_date))
  }

  const selectedEvents = selectedDate ? eventsOnDate(selectedDate) : []

  function goToMonth(delta) {
    setCursor((c) => shiftMonth(c.year, c.month, delta))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          aria-label="이전 달"
          className="pressable flex items-center justify-center w-8 h-8 rounded-mini text-mute dark:text-mute hover:text-ink dark:hover:text-ink"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-body font-bold text-ink dark:text-ink tabular-nums">
          {monthLabel(cursor.year, cursor.month)}
        </span>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="다음 달"
          className="pressable flex items-center justify-center w-8 h-8 rounded-mini text-mute dark:text-mute hover:text-ink dark:hover:text-ink"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-micro font-semibold text-mute dark:text-mute text-center py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} aria-hidden="true" />

          const hasEvent = eventsOnDate(cell.date).length > 0
          const isToday = cell.date === today
          const isSelected = cell.date === selectedDate

          return (
            <button
              key={cell.date}
              type="button"
              data-testid={`cal-day-${cell.date}`}
              onClick={() => setSelectedDate(cell.date)}
              aria-label={`${cell.day}일${hasEvent ? ' (일정 있음)' : ''}`}
              aria-pressed={isSelected}
              aria-current={isToday ? 'date' : undefined}
              className={`pressable relative aspect-square min-h-[36px] flex flex-col items-center justify-center gap-0.5 rounded-mini text-label font-semibold tabular-nums ${
                isSelected
                  ? 'bg-accent dark:bg-accent text-white dark:text-ink'
                  : isToday
                    ? 'border border-accent dark:border-accent text-accent-ink dark:text-accent'
                    : 'text-ink dark:text-ink'
              }`}
            >
              {cell.day}
              {hasEvent && (
                <span
                  aria-hidden="true"
                  className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white dark:bg-ink' : 'bg-accent dark:bg-accent'}`}
                />
              )}
            </button>
          )
        })}
      </div>

      {selectedDate && (
        <div className="mt-3 pt-3 border-t border-line dark:border-line">
          {selectedEvents.length === 0 ? (
            <p className="text-label text-mute dark:text-mute">이 날은 등록된 일정이 없어요</p>
          ) : (
            <div className="flex flex-col gap-2">
              {selectedEvents.map((ev, i) => (
                <div key={`${ev.title}-${ev.start_date}-${i}`}>
                  <p className="text-body font-semibold text-ink dark:text-ink">{ev.title}</p>
                  <p className="text-label font-semibold text-mute dark:text-mute mt-0.5">
                    {formatDateOrRange(ev.start_date, ev.end_date)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
