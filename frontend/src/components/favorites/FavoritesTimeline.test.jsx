/**
 * FavoritesTimeline — 삭제 수단 회귀 테스트.
 *
 * 배경: 이 뷰가 기본 탭인데도 즐겨찾기를 지울 방법이 아예 없었다(오버플로
 * 메뉴가 FavoritesList에만 있었음). RemoveUndoToast까지 같은 훅(useUndoRemove)을
 * 공유하므로, 여기서는 "메뉴 → 해제 클릭 → onRemove 호출"과 "해제 직후
 * 되돌리기 토스트가 뜬다"만 검증한다(되돌리기 자체의 상세 동작은
 * useUndoRemove가 이미 순수 훅 레벨에서 보장).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FavoritesTimeline from './FavoritesTimeline'

const ITEM = {
  id: 'route:test',
  routeCode: '77',
  stationName: '테스트정류장',
  destination: '테스트행',
  minutes: 5,
  detail: { type: 'bus', title: '77번 버스' },
}

describe('FavoritesTimeline — 삭제', () => {
  it('오버플로 메뉴의 "즐겨찾기 해제"를 누르면 onRemove(id)가 호출된다', () => {
    const onRemove = vi.fn()
    render(<FavoritesTimeline items={[ITEM]} onRemove={onRemove} />)

    fireEvent.click(screen.getByLabelText('편집 메뉴'))
    fireEvent.click(screen.getByText('즐겨찾기 해제'))

    expect(onRemove).toHaveBeenCalledWith(ITEM.id)
  })

  it('해제 직후 되돌리기 토스트가 뜬다', () => {
    const onRemove = vi.fn()
    render(<FavoritesTimeline items={[ITEM]} onRemove={onRemove} />)

    fireEvent.click(screen.getByLabelText('편집 메뉴'))
    fireEvent.click(screen.getByText('즐겨찾기 해제'))

    expect(screen.getByText(/즐겨찾기를 해제했어요/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '즐겨찾기 해제 되돌리기' })).toBeInTheDocument()
  })

  it('되돌리기를 누르면 onRemove가 한 번 더 호출된다(토글이므로 재호출이 곧 복원)', () => {
    const onRemove = vi.fn()
    render(<FavoritesTimeline items={[ITEM]} onRemove={onRemove} />)

    fireEvent.click(screen.getByLabelText('편집 메뉴'))
    fireEvent.click(screen.getByText('즐겨찾기 해제'))
    fireEvent.click(screen.getByRole('button', { name: '즐겨찾기 해제 되돌리기' }))

    expect(onRemove).toHaveBeenCalledTimes(2)
    expect(onRemove).toHaveBeenNthCalledWith(2, ITEM.id)
  })
})
