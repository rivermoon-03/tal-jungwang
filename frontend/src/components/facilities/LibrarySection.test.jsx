/**
 * LibrarySection — 로딩 스켈레톤을 공용 Skeleton으로 통일했는지 회귀 테스트.
 *
 * 예전엔 이 파일만 자체 `animate-pulse` div를 썼다(common/Skeleton — 그라디언트
 * 스윕 시머 + prefers-reduced-motion 자동 무력화 — 를 쓰는 다른 컴포넌트들과
 * 달랐다). tj-skeleton 클래스로 통일됐는지 고정한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import LibrarySection from './LibrarySection'

const mockUseLibraryHours = vi.fn()
const mockUseAcademicCalendar = vi.fn()
vi.mock('../../hooks/useMore', () => ({
  useLibraryHours: (...args) => mockUseLibraryHours(...args),
  useAcademicCalendar: (...args) => mockUseAcademicCalendar(...args),
}))

describe('LibrarySection — 로딩 상태', () => {
  it('로딩 중(rooms 없음)이면 공용 Skeleton(tj-skeleton)을 렌더한다(자체 animate-pulse 아님)', () => {
    mockUseLibraryHours.mockReturnValue({ loading: true, data: null, refetch: vi.fn() })
    mockUseAcademicCalendar.mockReturnValue({ loading: true, data: null })

    const { container } = render(<LibrarySection />)

    expect(container.querySelector('.tj-skeleton')).toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('열람실 데이터가 있으면 LibraryPanel을 렌더한다', () => {
    mockUseLibraryHours.mockReturnValue({
      loading: false,
      data: [{ room: '제1열람실', closed: false }],
      refetch: vi.fn(),
    })
    mockUseAcademicCalendar.mockReturnValue({ loading: false, data: null })

    render(<LibrarySection />)

    expect(screen.getByText('도서관 열람실')).toBeInTheDocument()
  })
})
