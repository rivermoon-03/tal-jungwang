/**
 * AcademicCalendarGrid — 월간 그리드 캘린더 단위 테스트.
 * 날짜는 항상 고정된 `now`/이벤트를 넘겨 오늘 날짜에 의존하지 않게 한다.
 */
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import AcademicCalendarGrid from './AcademicCalendarGrid'
import { daysInMonth } from '../../utils/academicCalendar'

// KST 2026-07-18 12:00 고정.
const NOW = new Date('2026-07-18T03:00:00Z')

const EVENTS = [
  { title: '기말고사', start_date: '2026-07-09', end_date: '2026-07-22' },
  { title: '2학기 개강', start_date: '2026-09-01', end_date: '2026-09-01' },
]

describe('AcademicCalendarGrid — 그리드 렌더링', () => {
  it('요일 헤더 7개를 렌더링한다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    // '월' 탭(SegmentTabs)과 요일 헤더 '월'이 텍스트가 같으므로 헤더 영역으로 스코프한다.
    const header = within(screen.getByTestId('cal-weekday-header'))
    for (const w of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(header.getByText(w)).toBeInTheDocument()
    }
  })

  it('해당 월의 일수만큼 날짜 셀을 렌더링한다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    const total = daysInMonth(2026, 7)
    for (let d = 1; d <= total; d++) {
      const dd = String(d).padStart(2, '0')
      expect(screen.getByTestId(`cal-day-2026-07-${dd}`)).toBeInTheDocument()
    }
    // 다음 달(8월) 첫날은 이 그리드에 없어야 한다.
    expect(screen.queryByTestId('cal-day-2026-08-01')).not.toBeInTheDocument()
  })

  it('오늘 날짜 셀에 aria-current="date"가 있다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    expect(screen.getByTestId('cal-day-2026-07-18')).toHaveAttribute('aria-current', 'date')
  })
})

describe('AcademicCalendarGrid — 이벤트 마커', () => {
  it('이벤트 범위(양끝 포함)에 걸리는 날짜는 마커가 있다고 aria-label에 표시한다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    expect(screen.getByTestId('cal-day-2026-07-09')).toHaveAttribute('aria-label', expect.stringContaining('일정 있음'))
    expect(screen.getByTestId('cal-day-2026-07-15')).toHaveAttribute('aria-label', expect.stringContaining('일정 있음'))
    expect(screen.getByTestId('cal-day-2026-07-22')).toHaveAttribute('aria-label', expect.stringContaining('일정 있음'))
  })

  it('이벤트 범위 밖의 날짜는 마커가 없다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    expect(screen.getByTestId('cal-day-2026-07-23')).not.toHaveAttribute('aria-label', expect.stringContaining('일정 있음'))
  })
})

describe('AcademicCalendarGrid — 월 이동', () => {
  it('다음 달 버튼을 누르면 다음 달로 이동한다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    expect(screen.getByText('2026년 7월')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
  })

  it('이전 달 버튼을 누르면 연도를 넘어 이동한다', () => {
    render(<AcademicCalendarGrid events={[]} initialDate="2026-01-15" now={NOW} />)
    expect(screen.getByText('2026년 1월')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이전 달' }))
    expect(screen.getByText('2025년 12월')).toBeInTheDocument()
  })
})

describe('AcademicCalendarGrid — 날짜 선택', () => {
  it('이벤트가 있는 날짜를 탭하면 아래에 이벤트 제목과 날짜 범위가 표시된다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-day-2026-07-09'))
    expect(screen.getByText('기말고사')).toBeInTheDocument()
    expect(screen.getByText('7월 9일 ~ 7월 22일')).toBeInTheDocument()
  })

  it('이벤트가 없는 날짜를 탭하면 빈 상태 문구를 표시한다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-day-2026-07-25'))
    expect(screen.getByText('이 날은 등록된 일정이 없어요')).toBeInTheDocument()
  })

  it('initialDate를 주면 해당 날짜가 속한 달로 초기 이동하고 이벤트를 미리 보여준다', () => {
    render(<AcademicCalendarGrid events={EVENTS} initialDate="2026-09-01" now={NOW} />)
    expect(screen.getByText('2026년 9월')).toBeInTheDocument()
    expect(screen.getByText('2학기 개강')).toBeInTheDocument()
  })
})

describe('AcademicCalendarGrid — 월/주 탭', () => {
  it('기본은 월간 뷰이고, "월"/"주" 탭이 렌더링된다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    expect(screen.getByRole('tab', { name: '월' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '주' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('2026년 7월')).toBeInTheDocument()
  })

  it('"주" 탭을 누르면 오늘(2026-07-18, 토)이 속한 주(일~토)로 전환된다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    expect(screen.getByRole('tab', { name: '주' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('7월 12일 ~ 7월 18일')).toBeInTheDocument()
  })

  it('주간 뷰는 일요일부터 토요일까지 정확히 7일을 보여준다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    const days = ['2026-07-12', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18']
    for (const d of days) {
      expect(screen.getByTestId(`week-day-${d}`)).toBeInTheDocument()
    }
    // 이전/다음 주 날짜는 없어야 한다.
    expect(screen.queryByTestId('week-day-2026-07-11')).not.toBeInTheDocument()
    expect(screen.queryByTestId('week-day-2026-07-19')).not.toBeInTheDocument()
  })

  it('주간 뷰에서 오늘 날짜 행에 aria-current="date"가 있다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    expect(screen.getByTestId('week-day-2026-07-18')).toHaveAttribute('aria-current', 'date')
    expect(screen.getByTestId('week-day-2026-07-12')).not.toHaveAttribute('aria-current')
  })

  it('주 전체에 걸치는 이벤트는 레인 1개로 표시되고(하루당 중복 없음), 상세에도 보인다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    // 기말고사(7/9~7/22)가 이번 주(7/12~7/18) 전체를 덮으므로 레인은 1개만 렌더링된다.
    const laneGrid = within(screen.getByTestId('week-lane-grid'))
    expect(laneGrid.getAllByTestId('week-lane')).toHaveLength(1)
    expect(laneGrid.getByText('기말고사')).toBeInTheDocument()
    // 오늘(7/18)이 기본 선택일이라 하단 상세에도 같은 이벤트가 보인다.
    expect(screen.getByText('9일~22일')).toBeInTheDocument()
  })

  it('요일 탭을 눌러 선택일을 바꾸면 하단 상세가 그 날 기준으로 갱신된다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' })) // 7/19~7/25
    // 7/25는 기말고사(~7/22) 범위 밖 → 일정 없음.
    fireEvent.click(screen.getByTestId('week-day-2026-07-25'))
    expect(screen.getByTestId('week-day-2026-07-25')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('일정 없음')).toBeInTheDocument()
    // 같은 주의 7/19~7/22는 기말고사 범위 안.
    fireEvent.click(screen.getByTestId('week-day-2026-07-20'))
    expect(screen.getByTestId('week-day-2026-07-20')).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByTestId('week-day-detail')).getByText('기말고사')).toBeInTheDocument()
  })

  it('이벤트가 전혀 없는 주는 레인 없이 하단에 "일정 없음"만 보인다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    // 8/9(기말고사·개강 범위 모두 밖)가 있는 주로 이동.
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    expect(within(screen.getByTestId('week-lane-grid')).queryAllByTestId('week-lane')).toHaveLength(0)
    expect(screen.getByText('일정 없음')).toBeInTheDocument()
  })

  it('일요일 탭 라벨은 delayed 톤을 쓴다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    const sundayCell = within(screen.getByTestId('week-day-2026-07-12'))
    expect(sundayCell.getByText('일')).toHaveClass('text-delayed')
    const mondayCell = within(screen.getByTestId('week-day-2026-07-13'))
    expect(mondayCell.getByText('월')).not.toHaveClass('text-delayed')
  })

  it('레인이 3행을 넘으면 4번째부터는 숨기고 "+N개"로 요약한다', () => {
    // 이번 주(7/12~7/18) 전체에 걸치는 서로 겹치는 이벤트 4개 → 4개 행이 필요하지만 3행까지만 표시.
    const overlapping = ['A', 'B', 'C', 'D'].map((title) => ({
      title,
      start_date: '2026-07-12',
      end_date: '2026-07-18',
    }))
    render(<AcademicCalendarGrid events={overlapping} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    expect(within(screen.getByTestId('week-lane-grid')).getAllByTestId('week-lane')).toHaveLength(3)
    expect(screen.getByText('+1개')).toBeInTheDocument()
  })

  it('이전 주/다음 주 버튼으로 한 주씩 이동한다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    expect(screen.getByText('7월 19일 ~ 7월 25일')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '이전 주' }))
    fireEvent.click(screen.getByRole('button', { name: '이전 주' }))
    expect(screen.getByText('7월 5일 ~ 7월 11일')).toBeInTheDocument()
  })

  it('월에서 날짜를 선택한 뒤 주 탭으로 전환하면 그 날짜가 속한 주를 보여준다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByTestId('cal-day-2026-07-09'))
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    // 7/9(목)이 속한 주는 7/5(일)~7/11(토).
    expect(screen.getByText('7월 5일 ~ 7월 11일')).toBeInTheDocument()
  })

  it('주 탭에서 이동한 뒤 월 탭으로 돌아가면 그 주가 속한 달을 보여준다', () => {
    render(<AcademicCalendarGrid events={[]} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    // 3주 뒤(7/12 → 8/2 시작 주)는 8월로 넘어간다.
    fireEvent.click(screen.getByRole('tab', { name: '월' }))
    expect(screen.getByText('2026년 8월')).toBeInTheDocument()
  })
})
