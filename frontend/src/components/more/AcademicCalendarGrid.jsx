/**
 * AcademicCalendarGrid — 학사일정 월간/주간 캘린더.
 *
 * 상단 작은 세그먼트 탭(이번 주/월 전체보기)으로 전환한다.
 * 결함 #34 — 예전엔 거대한 월간 그리드가 기본이라 화면의 절반을 차지했다.
 * 기본값을 주간 스트립 1줄로 낮추고, 월간 전체 뷰는 필요할 때만 토글해서 본다.
 * - 주(week, 기본): 상단에 요일 스트립(일~토 날짜 숫자, 요일 탭으로 선택일 변경) +
 *   그 아래 7열 색 레인 그리드(기간 일정이 하루당 한 줄이 아니라 가로로 이어진
 *   막대 하나로 보임) + 하단 선택일 상세 목록. 레인 배치는 utils/academicWeekLanes.js의
 *   buildWeekLanes로 위임한다(겹치는 일정은 그리디로 행을 나눠 배치).
 * - 월(month): 요일 헤더 + 7열 날짜 그리드. 이벤트(start_date~end_date, 양끝 포함)
 *   범위에 걸리는 날짜엔 점 마커를 표시하고, 날짜를 탭하면 그 날의 이벤트를 아래에 보여준다.
 *
 * 탭을 전환해도 같은 날짜 기준(선택했던 날짜 ↔ 그 날짜가 속한 달)을 유지한다.
 *
 * 날짜 계산(월/주 이동·일수·요일·범위 판정)은 전부 utils/academicCalendar.js
 * 헬퍼로 위임한다 — 인라인 Date 파싱/연산 금지(mistakes.md §1·§2).
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import SegmentTabs from '../ui/SegmentTabs'
import IconButton from '../ui/IconButton'
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
import { buildWeekLanes, categorizeEvent, formatDayRangeLabel } from '../../utils/academicWeekLanes'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
// 주간 스트립이 기본(우선순위 높음)이라 탭 순서도 주 → 월로 둔다.
const VIEW_TABS = [
  { id: 'week', label: '이번 주' },
  { id: 'month', label: '월 전체보기' },
]

// 카테고리 → 칩 팔레트 매핑(표시 헬퍼 상수). laneBg/laneText는 주간 레인 막대,
// bar는 하단 상세 목록의 세로 색 바에 쓴다.
const CATEGORY_STYLE = {
  enrollment: {
    laneBg: 'bg-accent-bg dark:bg-accent-bg',
    laneText: 'text-accent-ink dark:text-accent',
    bar: 'bg-accent dark:bg-accent',
  },
  degree: {
    laneBg: 'bg-chip-purple-bg dark:bg-chip-purple-bg',
    laneText: 'text-chip-purple-fg dark:text-chip-purple-fg',
    bar: 'bg-chip-purple-fg dark:bg-chip-purple-fg',
  },
  registration: {
    laneBg: 'bg-chip-blue-bg dark:bg-chip-blue-bg',
    laneText: 'text-chip-blue-fg dark:text-chip-blue-fg',
    bar: 'bg-chip-blue-fg dark:bg-chip-blue-fg',
  },
  etc: {
    laneBg: 'bg-chip-gray-bg dark:bg-chip-gray-bg',
    laneText: 'text-chip-gray-fg dark:text-chip-gray-fg',
    bar: 'bg-chip-gray-fg dark:bg-chip-gray-fg',
  },
}

// 레인 그리드에 한 번에 보여줄 최대 행 수. 넘치면 "+N개"로 요약한다.
const MAX_VISIBLE_LANE_ROWS = 3

export default function AcademicCalendarGrid({ events = [], initialDate = null, now = new Date() }) {
  const today = todayKstDateString(now)
  const startDate = initialDate || today
  const [initY, initM] = startDate.split('-').map(Number)

  const [viewMode, setViewMode] = useState('week')
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

  // 주간 뷰에서 실제로 강조/상세 표시에 쓰는 날짜. selectedDate가 지금 보이는
  // 주 밖이면(월 탭에서 고른 날짜가 다른 주였거나, 주 이동으로 벗어난 경우)
  // 오늘이 이 주에 있으면 오늘로, 아니면 이 주의 첫 날(일요일)로 대체한다.
  // effect로 별도 state를 동기화하지 않고 렌더 중 파생값으로만 계산한다.
  const weekSelectedDate = weekGrid.some((c) => c.date === selectedDate)
    ? selectedDate
    : (weekGrid.find((c) => c.date === today) ?? weekGrid[0])?.date ?? selectedDate
  const weekLanes = buildWeekLanes(events, weekAnchor)

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
        <IconButton
          label={viewMode === 'month' ? '이전 달' : '이전 주'}
          onClick={() => (viewMode === 'month' ? goToMonth(-1) : goToWeek(-1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </IconButton>
        <span className="text-body font-bold text-ink dark:text-ink tabular-nums">
          {viewMode === 'month' ? monthLabel(cursor.year, cursor.month) : weekRangeLabel(weekAnchor)}
        </span>
        <IconButton
          label={viewMode === 'month' ? '다음 달' : '다음 주'}
          onClick={() => (viewMode === 'month' ? goToMonth(1) : goToWeek(1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </IconButton>
      </div>

      {viewMode === 'month' ? (
        <>
          <div data-testid="cal-weekday-header" className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="text-dest font-semibold text-mute dark:text-mute text-center py-1">
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
                  // 셀은 모바일에서만 정사각형이다. PC에서 aspect-square를 유지하면
                  // 폭이 넓어지는 만큼 높이도 커져(1920px에서 한 변 222px) 한 달이
                  // 화면에 들어오지 않고 내부 스크롤을 두 번 넘게 해야 했다.
                  className={`pressable hoverable relative aspect-square min-h-[36px] md:aspect-auto md:h-[60px] lg:h-[68px] flex flex-col items-center justify-center gap-0.5 rounded-mini text-label font-semibold tabular-nums ${
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
        <WeekLaneView
          weekGrid={weekGrid}
          today={today}
          selectedDate={weekSelectedDate}
          onSelectDate={setSelectedDate}
          lanes={weekLanes}
          dayEvents={eventsOnDate(weekSelectedDate)}
        />
      )}
    </div>
  )
}

// 주간 뷰 — 상단 요일 스트립(탭, 선택일 변경) + 7열 색 레인 그리드(기간 일정이
// 하루당 한 줄이 아니라 가로 막대 하나로 보임) + 하단 선택일 상세 목록.
// 레인 배치(colStart/span/row)는 상위에서 buildWeekLanes로 미리 계산해 받는다.
function WeekLaneView({ weekGrid, today, selectedDate, onSelectDate, lanes, dayEvents }) {
  const visibleLanes = lanes.filter((lane) => lane.row < MAX_VISIBLE_LANE_ROWS)
  const hiddenCount = lanes.length - visibleLanes.length

  return (
    <div>
      <div role="tablist" aria-label="요일 선택" className="grid grid-cols-7 gap-1 mb-1">
        {weekGrid.map((cell, i) => {
          const isToday = cell.date === today
          const isSelected = cell.date === selectedDate
          const isSunday = i === 0
          return (
            <button
              key={cell.date}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              data-testid={`week-day-${cell.date}`}
              data-today={isToday ? 'true' : undefined}
              onClick={() => onSelectDate(cell.date)}
              // 결함 #14: 예전엔 "오늘"이 채움 배경, "선택"이 외곽선이라 초기값처럼
              // 오늘과 선택이 다른 날(예: initialDate로 다른 날짜가 먼저 선택된 경우)
              // 두 날짜가 동시에 서로 다른 방식으로 강조돼 어느 쪽이 오늘인지 읽을 수
              // 없었다. 학식 요일 칩(DayChips)이 이미 쓰는 규칙, 선택은 채움이고
              // 오늘은 점으로 통일한다. 채움은 방금 사용자가 고른 능동적 상태라
              // 가장 센 신호를 받고, 오늘은 배경 정보라 점 하나로 충분하다.
              className={`pressable flex flex-col items-center justify-center gap-0.5 rounded-mini py-1.5 min-h-[44px] ${
                isSelected ? 'bg-accent-bg dark:bg-accent-bg' : ''
              }`}
            >
              <span
                className={`text-dest font-semibold ${
                  isSunday ? 'text-delayed dark:text-delayed' : 'text-mute dark:text-mute'
                }`}
              >
                {WEEKDAY_LABELS[i]}
              </span>
              {/* PC의 넓은 셀에서 결함: 점을 버튼 corner(top-1.5 right-1.5)에
                  절대배치했더니, 셀 폭이 넓어질수록 가운데 정렬된 날짜 숫자와
                  점 사이 거리가 벌어져 어느 날짜의 점인지 읽히지 않았다(좁은
                  모바일 칩에서만 우연히 붙어 보였다). 날짜 숫자를 감싼 좁은
                  래퍼를 기준으로 점을 배치해, 셀 폭과 무관하게 숫자 바로
                  옆에 점이 붙게 한다. */}
              <span className="relative inline-flex">
                <span
                  className={`text-body font-bold tabular-nums ${
                    isSelected ? 'text-accent-ink dark:text-accent' : 'text-ink dark:text-ink'
                  }`}
                >
                  {cell.day}
                </span>
                {isToday && (
                  <span
                    aria-hidden="true"
                    className={`absolute -top-0.5 -right-2 h-1.5 w-1.5 rounded-full ${
                      isSelected ? 'bg-accent-ink dark:bg-accent' : 'bg-imminent dark:bg-imminent'
                    }`}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-dest font-semibold text-mute dark:text-mute mb-2">점은 오늘 · 채움은 선택</p>

      <div data-testid="week-lane-grid" className="grid grid-cols-7 gap-1 auto-rows-[22px]">
        {visibleLanes.map((lane, i) => (
          <div
            key={`${lane.title}-${lane.colStart}-${i}`}
            data-testid="week-lane"
            title={lane.title}
            style={{ gridColumn: `${lane.colStart} / span ${lane.span}`, gridRow: lane.row + 1 }}
            className={`rounded-mini px-1.5 flex items-center text-dest font-semibold truncate ${CATEGORY_STYLE[lane.category].laneBg} ${CATEGORY_STYLE[lane.category].laneText}`}
          >
            {lane.title}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <p className="text-dest font-semibold text-mute dark:text-mute text-right mt-1">+{hiddenCount}개</p>
      )}

      <div data-testid="week-day-detail" className="mt-3 pt-3 border-t border-line dark:border-line">
        {dayEvents.length === 0 ? (
          <p className="text-label text-mute dark:text-mute">일정 없음</p>
        ) : (
          <div className="flex flex-col gap-2">
            {dayEvents.map((ev, i) => {
              const category = categorizeEvent(ev.title)
              return (
                <div key={`${ev.title}-${ev.start_date}-${i}`} className="flex items-stretch gap-2">
                  <span
                    aria-hidden="true"
                    className={`w-1 rounded-full flex-shrink-0 ${CATEGORY_STYLE[category].bar}`}
                  />
                  <div>
                    <p className="text-body font-semibold text-ink dark:text-ink">{ev.title}</p>
                    <p className="text-label font-semibold text-mute dark:text-mute mt-0.5">
                      {formatDayRangeLabel(ev.start_date, ev.end_date)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
