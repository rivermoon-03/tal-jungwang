import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ShuttleNotifySheet from './ShuttleNotifySheet'

describe('ShuttleNotifySheet', () => {
  it('open이 false면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <ShuttleNotifySheet open={false} time="17:50" directionLabel="등교" onClose={() => {}} onConfirm={() => {}} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('제목/부제/칩 3개를 렌더링한다', () => {
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={() => {}} onConfirm={() => {}} />
    )
    expect(screen.getByText('17:50 셔틀 알림')).toBeInTheDocument()
    expect(screen.getByText('등교')).toBeInTheDocument()
    expect(screen.getByText('10분 전')).toBeInTheDocument()
    expect(screen.getByText('5분 전')).toBeInTheDocument()
    expect(screen.getByText('출발 시')).toBeInTheDocument()
  })

  it('기본 선택은 10분 전이고, 알림 켜기 클릭 시 onConfirm(10)이 호출된다', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ok: true })
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={() => {}} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('알림 켜기'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(10))
  })

  it('칩을 바꿔 선택하면 해당 lead로 onConfirm이 호출된다', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ok: true })
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={() => {}} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('출발 시'))
    fireEvent.click(screen.getByText('알림 켜기'))
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(0))
  })

  it('취소 버튼 클릭 시 onClose가 호출된다', () => {
    const onClose = vi.fn()
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={onClose} onConfirm={() => {}} />
    )
    fireEvent.click(screen.getByText('취소'))
    expect(onClose).toHaveBeenCalled()
  })

  it('onConfirm이 권한 거부를 반환하면 안내 문구를 보여준다', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ok: false, reason: 'denied' })
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={() => {}} onConfirm={onConfirm} />
    )
    fireEvent.click(screen.getByText('알림 켜기'))
    await screen.findByText(/브라우저 알림 권한이 꺼져있어요/)
  })

  it('오버레이 클릭 시 onClose가 호출된다', () => {
    const onClose = vi.fn()
    render(
      <ShuttleNotifySheet open time="17:50" directionLabel="등교" onClose={onClose} onConfirm={() => {}} />
    )
    const overlay = document.querySelector('.bg-black\\/50')
    fireEvent.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })
})
