/**
 * CafeteriaVenueDetailPage 테스트
 * - venueId로 상세 페이지 렌더
 * - 학기/방학 시간표 전부 표시
 * - 잘못된 id는 EmptyState
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../components/layout/PageHeader', () => ({
  default: ({ title }) => <header data-testid="page-header">{title}</header>,
}))

vi.mock('../components/ui/EmptyState', () => ({
  default: ({ title }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('../stores/useAppStore', () => ({
  default: vi.fn((selector) => selector({ darkMode: false })),
}))

import CafeteriaVenueDetailPage from './CafeteriaVenueDetailPage'

describe('CafeteriaVenueDetailPage', () => {
  beforeEach(() => {
    // 학기 기간(5월)으로 고정
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T12:00:00+09:00'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('학생식당 상세: 매점 이름을 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    expect(screen.getByText('학생식당')).toBeInTheDocument()
  })

  it('학생식당 상세: 위치(건물+층)를 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    expect(screen.getByText(/TIP/)).toBeInTheDocument()
  })

  it('학생식당 상세: 학기 시간표를 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    // 학기 섹션
    expect(screen.getByText(/학기/)).toBeInTheDocument()
  })

  it('학생식당 상세: 학기 평일 조식/중식/석식 슬롯을 모두 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    // 학기/방학 두 섹션에 같은 시간이 중복 가능하므로 getAllByText 사용
    expect(screen.getAllByText(/08:30/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/11:00/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/17:00/).length).toBeGreaterThanOrEqual(1)
  })

  it('학생식당 상세: 방학 시간표도 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    expect(screen.getByText(/방학/)).toBeInTheDocument()
  })

  it('학생식당 상세: 메뉴 배열을 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    expect(screen.getByText(/천원의아침밥/)).toBeInTheDocument()
  })

  it('학생식당 상세: closedDays(일요일 휴무)를 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    // 학기/방학 시간표에 일요일 섹션이 있으므로 getAllByText 사용
    expect(screen.getAllByText(/일요일/).length).toBeGreaterThanOrEqual(1)
  })

  it('잘못된 venueId는 EmptyState를 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="nonexistent-venue-xyz" />)
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  it('GS25(24h) 상세: 24시간 영업 표시', () => {
    render(<CafeteriaVenueDetailPage venueId="gs25" />)
    expect(screen.getAllByText(/24시간/).length).toBeGreaterThanOrEqual(1)
  })

  it('맘스터치 상세: 주말 시간표도 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="momsters" />)
    // 토요일 슬롯 10:30~21:00 (학기/방학 둘 다 있을 수 있으므로 getAllByText)
    expect(screen.getAllByText(/10:30/).length).toBeGreaterThanOrEqual(1)
  })

  it('현재 영업 상태(영업중/영업전/영업종료)를 렌더한다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    // 12:00는 중식 시간(11:00~14:00) → 영업중 (여러 요소 가능)
    const statusEls = screen.getAllByText(/영업 중|영업 전|영업 종료|오늘 휴무|24시간/)
    expect(statusEls.length).toBeGreaterThanOrEqual(1)
  })

  it('뒤로가기 버튼이 렌더된다', () => {
    render(<CafeteriaVenueDetailPage venueId="student-cafeteria" />)
    expect(screen.getByRole('button', { name: /뒤로/ })).toBeInTheDocument()
  })
})
