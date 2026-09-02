import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import DockQuickAccess from './DockQuickAccess'
import * as useAppStoreModule from '../../stores/useAppStore'

describe('DockQuickAccess', () => {
  const mockSetDetailModal = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockSetDetailModal.mockClear()
    mockOnClose.mockClear()
    vi.spyOn(useAppStoreModule, 'default').mockImplementation((selector) => {
      const state = {
        favorites: { routes: [] },
        setDetailModal: mockSetDetailModal,
      }
      return selector(state)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('즐겨찾기 0건일 때 안내 메시지 표시', () => {
    render(<DockQuickAccess onClose={mockOnClose} />)
    expect(screen.getByText('즐겨찾기를 추가하면 여기서 바로 열 수 있어요')).toBeInTheDocument()
  })

  it('즐겨찾기 최대 4건 표시', () => {
    vi.spyOn(useAppStoreModule, 'default').mockImplementation((selector) => {
      const state = {
        favorites: {
          routes: [
            '등교:20-1',
            'shuttle:등교',
            'subway:정왕:up',
            '하교:3400',
            '하교:6502',
          ],
        },
        setDetailModal: mockSetDetailModal,
      }
      return selector(state)
    })
    render(<DockQuickAccess onClose={mockOnClose} />)
    expect(screen.getByText('20-1')).toBeInTheDocument()
    expect(screen.getByText(/셔틀버스 등교/)).toBeInTheDocument()
    const wangsimni = screen.getAllByText(/정왕/)
    expect(wangsimni.length).toBeGreaterThan(0)
    expect(screen.getByText('3400')).toBeInTheDocument()
    // 목록 4건 + 하단 "전체 보기" 1개.
    const items = screen.getAllByRole('button').filter(
      (b) => !/전체 보기/.test(b.textContent)
    )
    expect(items).toHaveLength(4)
  })

  it('항목 탭 시 setDetailModal 호출 및 onClose 실행', () => {
    vi.spyOn(useAppStoreModule, 'default').mockImplementation((selector) => {
      const state = {
        favorites: { routes: ['등교:20-1'] },
        setDetailModal: mockSetDetailModal,
      }
      return selector(state)
    })
    render(<DockQuickAccess onClose={mockOnClose} />)
    const button = screen.getByRole('button', { name: /20-1/ })
    fireEvent.click(button)
    expect(mockSetDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bus',
        routeCode: '20-1',
        title: expect.any(String),
      })
    )
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('ESC 키로 닫힘', () => {
    render(<DockQuickAccess onClose={mockOnClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('바깥 탭으로 닫힘', () => {
    render(
      <div>
        <button data-testid="outside">Outside</button>
        <DockQuickAccess onClose={mockOnClose} />
      </div>
    )
    const outside = screen.getByTestId('outside')
    fireEvent.pointerDown(outside)
    expect(mockOnClose).toHaveBeenCalled()
  })

  // 팝오버는 4건까지만 보여준다. 여기서 나가는 길이 없으면 즐겨찾기가 사실상
  // 4칸짜리 기능이 된다 — 전체 목록(/favorites)이 라우팅에 붙기 전까지 실제로 그랬다.
  describe('전체 보기 진입점', () => {
    it('즐겨찾기가 없어도 전체 보기 버튼은 있다', () => {
      render(<DockQuickAccess onClose={mockOnClose} />)
      expect(screen.getByRole('button', { name: /즐겨찾기 전체 보기/ })).toBeInTheDocument()
    })

    it('누르면 /favorites 로 이동하고 팝오버가 닫힌다', () => {
      window.history.replaceState({}, '', '/')
      render(<DockQuickAccess onClose={mockOnClose} />)
      screen.getByRole('button', { name: /즐겨찾기 전체 보기/ }).click()
      expect(window.location.pathname).toBe('/favorites')
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('4건을 넘으면 숨은 개수를 알려준다', () => {
      vi.spyOn(useAppStoreModule, 'default').mockImplementation((selector) =>
        selector({
          favorites: { routes: ['하교:3400', '하교:6502', '등교:3401', '등교:5602', '하교:99-2', '등교:5200'] },
          setDetailModal: mockSetDetailModal,
        })
      )
      render(<DockQuickAccess onClose={mockOnClose} />)
      expect(screen.getByRole('button', { name: /전체 보기 \(\+2\)/ })).toBeInTheDocument()
    })
  })
})
