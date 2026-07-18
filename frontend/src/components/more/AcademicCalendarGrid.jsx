/**
 * AcademicCalendarGrid — 학사일정 월간/주간 캘린더.
 *
 * 상단 작은 세그먼트 탭(월/주)으로 전환한다.
 * - 월(month): 요일 헤더 + 7열 날짜 그리드. 이벤트(start_date~end_date, 양끝 포함)
 *   범위에 걸리는 날짜엔 점 마커를 표시하고, 날짜를 탭하면 그 날의 이벤트를 아래에 보여준다.
 * - 주(week): 한 주(일~토) 7일을 세로 리스트로 보여준다. 각 행에 이미 그 날의
 *   이벤트 제목이 보이므로 월간 뷰의 "탭 → 아래 이벤트 표시" 패턴은 쓰지 않는다.
 *
 * 탭을 전환해도 같은 날짜 기준(선택했던 날짜 ↔ 그 날짜가 속한 달)을 유지한다.
 *
 * 날짜 계산(월/주 이동·일수·요일·범위 판정)은 전부 utils/academicCalendar.js
 * 헬퍼로 위임한다 — 인라인 Date 파싱/연산 금지(mistakes.md §1·§2).
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SegmentTabs from '../ui/SegmentTabs'
import {
  todayKstDateString,
  buildMonthGrid,
  monthLabel,
  shiftMonth,
  isDateInRange,
  formatDateOrRange,
  buildWeekGrid,
  shiftWeek,
  weekRangeLabel,
} from '../../utils/academicCalendar'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const VIEW_TABS = [
  { id: 'month', label: '월' },
  { id: 'week', label: '주' },
]

export default function AcademicCalendarGrid({ events = [], initialDate = null, now = new Date() }) {
  const today = todayKstDateString(now)
  const startDate = initialDate || today
  const [initY, initM] = startDate.split('-').map(Number)

  const [viewMode, setViewMode] = useState('month')
  const [cursor, setCursor] = useState({ year: initY, month: initM })
  const [selectedDate, setSelectedDate] = useState(startDate)
  // 주간 뷰 기준 날짜(그 주에 속하기만 하면 됨 — buildWeekGrid/weekRangeLabel이
  // 내부에서 일요일로 정규화한다).
  const [weekAnchor, setWeekAnchor] = useState(startDate)

  const grid = buildMonthGrid(cursor.year, cursor.month)
  const weekGrid = buildWeekGrid(weekAnchor)

  function eventsOnDate(dateStr) {
    return events.filter((ev) => isDateInRange(dateStr, ev.start_date, ev.end_date))
  }

  const selectedEvents = selectedDate ? eventsOnDate(selectedDate) : []

  function goToMonth(delta) {
    setCursor((c) => shiftMonth(c.year, c.month, delta))
  }

  function goToWeek(delta) {
    setWeekAnchor((d) => shiftWeek(d, delta))
  }

  // 월↔주 전환 시 같은 날짜 기준을 유지: 월→주는 마지막으로 선택한 날짜가 속한
  // 주로, 주→월은 주간 뷰가 보여주던 주가 속한 달로 이동한다.
  function handleViewModeChange(mode) {
    setViewMode(mode)
    if (mode === 'week') {
      setWeekAnchor(selectedDate)
    } else {
      const [y, m] = weekAnchor.split('-').map(Number)
      setCursor({ year: y, month: m })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-center mb-3">
        <SegmentTabs items={VIEW_TABS} active={viewMode} onChange={handleViewModeChange} size="sm" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => (viewMode === 'month' ? goToMonth(-1) : goToWeek(-1))}
          aria-label={viewMode === 'month' ? '이전 달' : '이전 주'}
          className="pressable flex items-center justify-center w-8 h-8 rounded-mini text-mute dark:text-mute hover:text-ink dark:hover:text-ink"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-body font-bold text-ink dark:text-ink tabular-nums">
          {viewMode === 'month' ? monthLabel(cursor.year, cursor.month) : weekRangeLabel(weekAnchor)}
        </span>
        <button
          type="button"
          onClick={() => (viewMode === 'month' ? goToMonth(1) : goToWeek(1))}
          aria-label={viewMode === 'month' ? '다음 달' : '다음 주'}
          className="pressable flex items-center justify-center w-8 h-8 rounded-mini text-mute dark:text-mute hover:text-ink dark:hover:text-ink"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {viewMode === 'month' ? (
        <>
          <div data-testid="cal-weekday-header" className="grid grid-cols-7 gap-1 mb-1">
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
        </>
      ) : (
        <WeekList cells={weekGrid} today={today} eventsOnDate={eventsOnDate} />
      )}
    </div>
  )
}

// 주간 뷰 — 요일 라벨 + 날짜 숫자 + 그 날 이벤트 제목(있으면)을 세로 리스트로.
// 이벤트가 없는 날은 옅은 "일정 없음" 문구만 보여준다.
function WeekList({ cells, today, eventsOnDate }) {
  return (
    <div role="list" aria-label="주간 학사일정" className="flex flex-col gap-1">
      {cells.map((cell, i) => {
        const isToday = cell.date === today
        const dayEvents = eventsOnDate(cell.date)
        return (
          <div
            key={cell.date}
            role="listitem"
            data-testid={`week-day-${cell.date}`}
            aria-current={isToday ? 'date' : undefined}
            className={`flex items-start gap-3 px-2.5 py-2.5 rounded-mini ${
              isToday ? 'bg-accent-bg dark:bg-accent-bg border border-accent dark:border-accent' : ''
            }`}
          >
            <div className="flex flex-col items-center justify-center w-9 flex-shrink-0">
              <span
                className={`text-micro font-semibold ${
                  isToday ? 'text-accent-ink dark:text-accent' : 'text-mute dark:text-mute'
                }`}
              >
                {WEEKDAY_LABELS[i]}
              </span>
              <span
                className={`text-body font-bold tabular-nums ${
                  isToday ? 'text-accent-ink dark:text-accent' : 'text-ink dark:text-ink'
                }`}
              >
                {cell.day}
              </span>
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {dayEvents.length === 0 ? (
                <p className="text-label text-mute dark:text-mute">일정 없음</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {dayEvents.map((ev, idx) => (
                    <p key={`${ev.title}-${idx}`} className="text-label font-semibold text-ink dark:text-ink truncate">
                      {ev.title}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
