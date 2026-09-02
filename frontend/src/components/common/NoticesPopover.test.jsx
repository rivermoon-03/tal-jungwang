/**
 * NoticesPopover — 28px 닫기 버튼을 ui/IconButton(44px)으로 교체하고, 상태
 * 넷(로딩/에러/빈/정상)을 구분하고, 안읽음 도트를 추가했는지 회귀 검증한다.
 */
import { useRef } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../hooks/useMore', () => ({
  useNotices: vi.fn(),
}))

import { useNotices } from '../../hooks/useMore'
import { markNoticesSeen } from '../../utils/noticeReadState'
import NoticesPopover from './NoticesPopover'

const NOTICE = { id: 42, title: '버스 도착 정보 개선', content: '내용', created_at: '2026-08-01T00:00:00Z' }

function Wrapper(props) {
  const anchorRef = useRef(document.createElement('button'))
  return <NoticesPopover anchorRef={anchorRef} {...props} />
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('NoticesPopover — 상태 구분', () => {
  it('로딩 중이면 스켈레톤을 보여준다(문구 대신)', () => {
    useNotices.mockReturnValue({ data: null, loading: true, error: null, refetch: vi.fn() })
    render(<Wrapper open onClose={() => {}} />)
    // createPortal로 document.body에 붙으므로 RTL container가 아니라 document에서 찾는다.
    expect(document.querySelectorAll('.tj-skeleton').length).toBeGreaterThan(0)
  })

  it('에러면 다시 시도 버튼을 보여준다', () => {
    const refetch = vi.fn()
    useNotices.mockReturnValue({ data: null, loading: false, error: new Error('x'), refetch })
    render(<Wrapper open onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('빈 목록이면 안내 문구를 보여준다', () => {
    useNotices.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
    render(<Wrapper open onClose={() => {}} />)
    expect(screen.getByText('새 공지사항이 없어요')).toBeInTheDocument()
  })
})

describe('NoticesPopover — 닫기 버튼(IconButton)', () => {
  it('44px 히트 영역을 갖는다', () => {
    useNotices.mockReturnValue({ data: [], loading: false, error: null, refetch: vi.fn() })
    render(<Wrapper open onClose={() => {}} />)
    const closeBtn = screen.getByRole('button', { name: '닫기' })
    expect(closeBtn.className).toMatch(/min-h-\[44px\]/)
    expect(closeBtn.className).toMatch(/min-w-\[44px\]/)
  })
})

describe('NoticesPopover — 안읽음 도트', () => {
  it('처음 보는 공지는 열려 있는 동안 안읽음 도트가 켜진다', () => {
    useNotices.mockReturnValue({ data: [NOTICE], loading: false, error: null, refetch: vi.fn() })
    render(<Wrapper open onClose={() => {}} />)
    expect(document.querySelector('span.bg-accent')).not.toBeNull()
  })

  it('이미 확인한 공지는 안읽음 도트가 없다', () => {
    markNoticesSeen('app', [NOTICE.id])
    useNotices.mockReturnValue({ data: [NOTICE], loading: false, error: null, refetch: vi.fn() })
    render(<Wrapper open onClose={() => {}} />)
    expect(document.querySelector('span.bg-accent')).toBeNull()
  })

  it('벨을 닫으면 확인함으로 기록되어 다음에 다시 열었을 때 도트가 없다', () => {
    useNotices.mockReturnValue({ data: [NOTICE], loading: false, error: null, refetch: vi.fn() })
    const { rerender } = render(<Wrapper open onClose={() => {}} />)
    expect(document.querySelector('span.bg-accent')).not.toBeNull()

    // 닫기(open=false) — 이 시점에 "확인함"으로 기록된다.
    rerender(<Wrapper open={false} onClose={() => {}} />)
    // 다시 열기 — 이제는 이미 읽은 것으로 취급된다.
    rerender(<Wrapper open onClose={() => {}} />)
    expect(document.querySelector('span.bg-accent')).toBeNull()
  })
})
