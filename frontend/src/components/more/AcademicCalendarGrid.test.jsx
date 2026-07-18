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

  it('이벤트가 있는 날은 제목을, 없는 날은 "일정 없음"을 보여준다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    // 기말고사 범위(7/9~7/22) 안에 있는 이번 주 전체 날짜에 제목이 보여야 한다.
    expect(within(screen.getByTestId('week-day-2026-07-15')).getByText('기말고사')).toBeInTheDocument()
    expect(within(screen.getByTestId('week-day-2026-07-18')).getByText('기말고사')).toBeInTheDocument()
  })

  it('이벤트가 없는 주로 이동하면 "일정 없음" 문구가 보인다', () => {
    render(<AcademicCalendarGrid events={EVENTS} now={NOW} />)
    fireEvent.click(screen.getByRole('tab', { name: '주' }))
    // 8/9(기말고사 범위 밖)가 있는 다음다음 주로 이동.
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    fireEvent.click(screen.getByRole('button', { name: '다음 주' }))
    expect(within(screen.getByTestId('week-day-2026-08-08')).getByText('일정 없음')).toBeInTheDocument()
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
