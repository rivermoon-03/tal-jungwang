import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapSearchOverlay from './MapSearchOverlay'

const FILTERS = [
  { id: 'bus', label: '버스', active: true },
  { id: 'shuttle', label: '셔틀', active: false },
  { id: 'subway', label: '지하철', active: false },
  { id: 'taxi', label: '택시', active: false },
]

describe('MapSearchOverlay', () => {
  it('검색 입력창을 기본 placeholder로 렌더한다', () => {
    render(<MapSearchOverlay value="" onChange={() => {}} filters={FILTERS} />)
    expect(screen.getByPlaceholderText('노선·정류장 검색')).toBeInTheDocument()
  })

  it('입력값 변경 시 onChange가 새 값과 함께 호출된다', () => {
    const onChange = vi.fn()
    render(<MapSearchOverlay value="" onChange={onChange} filters={FILTERS} />)
    fireEvent.change(screen.getByPlaceholderText('노선·정류장 검색'), { target: { value: '정왕' } })
    expect(onChange).toHaveBeenCalledWith('정왕')
  })

  it('필터 칩 라벨이 모두 렌더된다', () => {
    render(<MapSearchOverlay value="" onChange={() => {}} filters={FILTERS} />)
    expect(screen.getByText('버스')).toBeInTheDocument()
    expect(screen.getByText('셔틀')).toBeInTheDocument()
    expect(screen.getByText('지하철')).toBeInTheDocument()
    expect(screen.getByText('택시')).toBeInTheDocument()
  })

  it('활성 칩은 aria-pressed=true, 비활성 칩은 aria-pressed=false로 표시된다', () => {
    render(<MapSearchOverlay value="" onChange={() => {}} filters={FILTERS} />)
    expect(screen.getByRole('button', { name: '버스' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '셔틀' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('칩 클릭 시 onToggleFilter가 해당 필터 id로 호출된다', () => {
    const onToggleFilter = vi.fn()
    render(
      <MapSearchOverlay value="" onChange={() => {}} filters={FILTERS} onToggleFilter={onToggleFilter} />
    )
    fireEvent.click(screen.getByRole('button', { name: '셔틀' }))
    expect(onToggleFilter).toHaveBeenCalledWith('shuttle')
  })

  it('필터가 없으면 칩 영역을 렌더하지 않는다', () => {
    render(<MapSearchOverlay value="" onChange={() => {}} filters={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
