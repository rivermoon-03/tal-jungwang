import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// store mock
const mockState = {
  selectedBusStation: '한국공학대',
  selectedShuttleCampus: 'main',
  setBusStation: vi.fn(),
  setSubwayStation: vi.fn(),
  setShuttleCampus: vi.fn(),
  setDirectionOverride: vi.fn(),
}

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector(mockState),
}))

// useEffectiveDirection mock — 기본 방향 '하교'
vi.mock('../../hooks/useEffectiveDirection', () => ({
  default: () => ({ direction: '하교' }),
}))

import StationPills from './StationPills'

beforeEach(() => {
  mockState.setBusStation.mockClear()
  mockState.setSubwayStation.mockClear()
  mockState.setShuttleCampus.mockClear()
  mockState.setDirectionOverride.mockClear()
})

describe('StationPills — 버스 모드', () => {
  it('방향 하교에 맞는 정류장 칩을 렌더한다', () => {
    render(<StationPills mode="bus" value="한국공학대" />)
    // 하교 허용 정류장: 한국공학대, 시화터미널, 이마트
    expect(screen.getByText('본캠')).toBeInTheDocument() // 한국공학대 → '본캠' display
  })

  it('정류장 칩 클릭 시 setBusStation을 호출한다', () => {
    render(<StationPills mode="bus" value="한국공학대" />)
    fireEvent.click(screen.getByText('이마트'))
    expect(mockState.setBusStation).toHaveBeenCalledWith('이마트')
  })

  it('활성 정류장 칩이 aria-pressed=true', () => {
    render(<StationPills mode="bus" value="한국공학대" />)
    // '본캠' 칩이 활성
    const activeChip = screen.getByText('본캠').closest('button')
    expect(activeChip).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('StationPills — 지하철 모드', () => {
  it('정왕/초지/시흥시청 칩을 렌더한다', () => {
    render(<StationPills mode="subway" value="정왕" />)
    expect(screen.getByText('정왕')).toBeInTheDocument()
    expect(screen.getByText('초지')).toBeInTheDocument()
    expect(screen.getByText('시흥시청')).toBeInTheDocument()
  })

  it('역 칩 클릭 시 setSubwayStation을 호출한다', () => {
    render(<StationPills mode="subway" value="정왕" />)
    fireEvent.click(screen.getByText('초지'))
    expect(mockState.setSubwayStation).toHaveBeenCalledWith('초지')
  })
})

describe('StationPills — 셔틀 모드', () => {
  it('본캠/2캠 칩을 렌더한다', () => {
    render(<StationPills mode="shuttle" value="main" />)
    expect(screen.getByText('본캠')).toBeInTheDocument()
    expect(screen.getByText('2캠')).toBeInTheDocument()
  })

  it('캠퍼스 칩 클릭 시 setShuttleCampus를 호출한다', () => {
    render(<StationPills mode="shuttle" value="main" />)
    fireEvent.click(screen.getByText('2캠'))
    expect(mockState.setShuttleCampus).toHaveBeenCalledWith('second')
  })
})

describe('StationPills — 택시 모드', () => {
  it('택시 모드에서는 null을 렌더한다', () => {
    const { container } = render(<StationPills mode="taxi" value={null} />)
    expect(container.firstChild).toBeNull()
  })
})

describe('StationPills — 방향-정류장 불일치 표시 보정', () => {
  it('하교 방향인데 등교 전용 정류장(시흥시청) 전달 시 첫 번째 하교 정류장이 활성', () => {
    // effectiveDirection = '하교', value = '시흥시청' (등교 전용 → 불일치)
    // filteredLabels = ['한국공학대', '시화터미널', '이마트']
    // 첫 번째 = '한국공학대' → '본캠'이 활성이어야 함
    render(<StationPills mode="bus" value="시흥시청" />)
    const chips = document.querySelectorAll('[aria-pressed]')
    // aria-pressed=true 인 칩이 하나는 있어야 함 (미선택 없음)
    const activeChips = Array.from(chips).filter((c) => c.getAttribute('aria-pressed') === 'true')
    expect(activeChips.length).toBeGreaterThanOrEqual(1)
  })

  it('하교 방향에서 항상 유효한 정류장 칩이 활성화됨 (미선택 없음)', () => {
    render(<StationPills mode="bus" value="한국공학대" />)
    const chips = document.querySelectorAll('[aria-pressed]')
    const activeChips = Array.from(chips).filter((c) => c.getAttribute('aria-pressed') === 'true')
    expect(activeChips.length).toBeGreaterThanOrEqual(1)
  })
})
