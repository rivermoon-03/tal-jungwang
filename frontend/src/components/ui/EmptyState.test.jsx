import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('title과 desc를 렌더한다', () => {
    render(<EmptyState title="비어있음" desc="설명" />)
    expect(screen.getByText('비어있음')).toBeInTheDocument()
    expect(screen.getByText('설명')).toBeInTheDocument()
  })

  it('icon이 기본적으로 aria-hidden 처리된다(altText 없을 때)', () => {
    const { container } = render(<EmptyState icon={<span data-testid="ico" />} title="t" />)
    const wrapper = container.querySelector('[aria-hidden="true"]')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.querySelector('[data-testid="ico"]')).toBeInTheDocument()
  })

  it('altText가 있으면 icon 래퍼에 aria-label을 부여하고 aria-hidden을 제거한다', () => {
    const { container } = render(
      <EmptyState icon={<span data-testid="ico" />} altText="버스는 아직 운행 중" title="t" />
    )
    const wrapper = screen.getByLabelText('버스는 아직 운행 중')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper.getAttribute('aria-hidden')).toBeNull()
    expect(container.querySelector('[data-testid="ico"]')).toBeInTheDocument()
  })

  it('nextInfo가 있으면 label/time/sub를 카드로 렌더한다', () => {
    render(
      <EmptyState
        title="오늘 운행이 끝났어요"
        nextInfo={{ label: '내일 첫차', time: '07:40', sub: '정왕역 출발' }}
      />
    )
    expect(screen.getByText('내일 첫차')).toBeInTheDocument()
    expect(screen.getByText('07:40')).toBeInTheDocument()
    expect(screen.getByText('정왕역 출발')).toBeInTheDocument()
  })

  it('nextInfo가 없으면 카드가 렌더되지 않는다', () => {
    render(<EmptyState title="t" />)
    expect(screen.queryByText('내일 첫차')).not.toBeInTheDocument()
  })

  it('actionLabel/onAction 조합으로 버튼이 렌더되고 클릭 시 onAction이 호출된다', () => {
    const onAction = vi.fn()
    render(<EmptyState title="t" actionLabel="첫차 알림 받기" onAction={onAction} />)
    const btn = screen.getByText('첫차 알림 받기')
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('onAction이 없으면 actionLabel만 있어도 버튼이 렌더되지 않는다', () => {
    render(<EmptyState title="t" actionLabel="첫차 알림 받기" />)
    expect(screen.queryByText('첫차 알림 받기')).not.toBeInTheDocument()
  })

  it('레거시 action prop이 계속 동작한다(하위호환)', () => {
    const onClick = vi.fn()
    render(<EmptyState title="t" action={{ label: '다시 확인', onClick }} />)
    fireEvent.click(screen.getByText('다시 확인'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('action과 actionLabel/onAction이 동시에 있으면 action(레거시)이 우선한다', () => {
    const legacyClick = vi.fn()
    const newClick = vi.fn()
    render(
      <EmptyState
        title="t"
        action={{ label: '레거시 버튼', onClick: legacyClick }}
        actionLabel="신규 버튼"
        onAction={newClick}
      />
    )
    expect(screen.getByText('레거시 버튼')).toBeInTheDocument()
    expect(screen.queryByText('신규 버튼')).not.toBeInTheDocument()
  })
})
