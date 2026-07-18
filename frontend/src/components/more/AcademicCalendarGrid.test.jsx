/**
 * AcademicCalendarGrid — 월간 그리드 캘린더 단위 테스트.
 * 날짜는 항상 고정된 `now`/이벤트를 넘겨 오늘 날짜에 의존하지 않게 한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
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
    for (const w of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(screen.getByText(w)).toBeInTheDocument()
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
