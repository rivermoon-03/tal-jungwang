/**
 * FavoritesList — 즐겨찾기 행이 공용 TransitCard 로 옮겨진 뒤의 회귀 테스트.
 *
 * 예전에는 이 화면만 dashboard/ArrivalRow 라는 별도 도착 카드를 썼다. 그 파일이
 * 지고 TransitCard 로 합쳐지면서, 거기 붙어 있던 동작 중 이 화면이 실제로 쓰는
 * 것들을 여기로 옮겨 고정한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import FavoritesList from './FavoritesList'

vi.mock('../../hooks/useBus', () => ({
  useBusArrivals: () => ({ data: null }),
  useBusTimetable: () => ({ data: null }),
}))

function item(overrides = {}) {
  return {
    id: 'fav-1',
    type: 'bus',
    routeCode: '20-1',
    destination: '정왕역',
    stationName: '한국공대',
    minutes: 7,
    detail: {},
    ...overrides,
  }
}

describe('FavoritesList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T08:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('노선번호와 행선지, 남은 시간을 렌더한다', () => {
    render(<FavoritesList items={[item()]} onRemove={() => {}} />)
    expect(screen.getByText('20-1')).toBeInTheDocument()
    expect(screen.getByText('정왕역 · 한국공대')).toBeInTheDocument()
    expect(screen.getByText('7분')).toBeInTheDocument()
  })

  it('상대시간 아래에 절대시각을 병기한다', () => {
    render(<FavoritesList items={[item()]} onRemove={() => {}} />)
    expect(screen.getByText('08:07')).toBeInTheDocument()
  })

  it('imminentLabel 이 있으면 그 문구를 쓰고 절대시각은 병기하지 않는다', () => {
    render(
      <FavoritesList
        items={[item({ imminentLabel: '곧 도착', minutes: 0 })]}
        onRemove={() => {}}
      />
    )
    expect(screen.getByText('곧 도착')).toBeInTheDocument()
    expect(screen.queryByText('08:00')).not.toBeInTheDocument()
  })

  it('도착 정보가 없으면 "운행 정보 없음"을 보여준다', () => {
    render(<FavoritesList items={[item({ minutes: null })]} onRemove={() => {}} />)
    expect(screen.getByText('운행 정보 없음')).toBeInTheDocument()
  })

  it('막차면 "막차" 칩이 붙는다', () => {
    render(<FavoritesList items={[item({ lastTrain: true })]} onRemove={() => {}} />)
    expect(screen.getByText('막차')).toBeInTheDocument()
  })

  it('도보 대비 여유 상태를 색이 아니라 이름 있는 점으로 표시한다', () => {
    render(
      <FavoritesList
        items={[item({ status: '서두르세요' })]}
        onRemove={() => {}}
      />
    )
    expect(screen.getByRole('img', { name: '서두르세요' })).toBeInTheDocument()
  })

  it('행을 누르면 상세가 열린다', () => {
    const onOpenDetail = vi.fn()
    render(
      <FavoritesList items={[item()]} onRemove={() => {}} onOpenDetail={onOpenDetail} />
    )
    fireEvent.click(screen.getByText('정왕역 · 한국공대'))
    expect(onOpenDetail).toHaveBeenCalled()
  })

  it('편집 메뉴 버튼은 카드가 button 을 중첩하지 않게 div[role=button] 안에 놓인다', () => {
    render(
      <FavoritesList items={[item()]} onRemove={() => {}} onOpenDetail={() => {}} />
    )
    const menu = screen.getByRole('button', { name: '편집 메뉴' })
    expect(menu.closest('button')).toBe(menu)
    const card = menu.closest('[role="button"]')
    expect(card).not.toBeNull()
    expect(card.tagName).toBe('DIV')
  })

  it('편집 메뉴를 눌러도 상세가 열리지 않는다', () => {
    const onOpenDetail = vi.fn()
    render(
      <FavoritesList items={[item()]} onRemove={() => {}} onOpenDetail={onOpenDetail} />
    )
    fireEvent.click(screen.getByRole('button', { name: '편집 메뉴' }))
    expect(onOpenDetail).not.toHaveBeenCalled()
    expect(screen.getByText('즐겨찾기 해제')).toBeInTheDocument()
  })
})
