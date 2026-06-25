import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SubwayLineCard from './SubwayLineCard'

// useAppStore mock
vi.mock('../../stores/useAppStore', () => ({
  default: (selector) => selector({ darkMode: false }),
}))

// useCountdown mock — 기본: 5분 00초, not urgent
vi.mock('../../hooks/useCountdown', () => ({
  useCountdown: () => ({ mm: '05', ss: '00', isUrgent: false, isExpired: false }),
}))

// 현재 시각: 06:05
beforeEach(() => {
  vi.useFakeTimers()
  const now = new Date()
  now.setHours(6, 5, 0, 0)
  vi.setSystemTime(now)
})

afterEach(() => {
  vi.useRealTimers()
})

// 06:10이 막차, 06:00이 첫차인 시나리오
const TRAINS = [
  { depart_at: '06:00', destination: '오이도' },
  { depart_at: '06:10', destination: '인천' },  // 다음 열차 (06:05 기준)
  { depart_at: '06:20', destination: '오이도' },
  { depart_at: '23:50', destination: '인천' },   // 막차
]

const DEFAULT_PROPS = {
  lineName: '수인분당선',
  dirLabel: '상행',
  color: '#F5A623',
  darkColor: '#fbbf24',
  lightColor: '#FEF6E6',
  trains: TRAINS,
  onClick: vi.fn(),
}

describe('SubwayLineCard', () => {
  // ── 제거 대상: 이모지 ─────────────────────────────────────────────────

  it('이모지가 렌더되지 않는다', () => {
    const { container } = render(<SubwayLineCard {...DEFAULT_PROPS} />)
    expect(/\p{Extended_Pictographic}/u.test(container.textContent)).toBe(false)
  })

  it('좌측 바(border-l-N px) 클래스가 없다', () => {
    const { container } = render(<SubwayLineCard {...DEFAULT_PROPS} />)
    // border-line 계열은 허용; border-l-[숫자] / border-l\b 만 금지
    expect(container.innerHTML).not.toMatch(/\bborder-l-\d+|\bborder-l\b/)
  })

  // ── 막차/첫차: StatusChip 텍스트 뱃지 ──────────────────────────────

  it('막차 표시 시 텍스트 "막차"가 렌더된다', () => {
    // 현재 시각을 23:45로 설정 → 23:50이 다음 열차
    // getSpecialTrainIndices: 06:00→06:10→06:20→23:50 — 23:50과 06:20 사이 gap=약1070분 ≥180
    // 따라서 lastIdx=2(06:20), firstIdx=3(23:50) — 단, nextTrainIdx는 23:45 기준으로 3(23:50)
    // isLast = nextTrainIdx(3) === lastIdx(2) → false
    // 이 시나리오는 막차 표시가 안 됨. 막차가 마지막 열차인 데이터로 교체.
    const now = new Date()
    now.setHours(23, 45, 0, 0)
    vi.setSystemTime(now)

    // 명확하게 막차가 nextTrain 인 데이터: gap 없이 마지막 열차 = lastIdx
    const lastTrainData = [
      { depart_at: '23:50', destination: '인천' },
    ]
    render(<SubwayLineCard {...DEFAULT_PROPS} trains={lastTrainData} />)
    expect(screen.getByText('막차')).toBeTruthy()
  })

  it('막차/첫차 텍스트 뱃지에 이모지가 포함되지 않는다', () => {
    const now = new Date()
    now.setHours(23, 45, 0, 0)
    vi.setSystemTime(now)

    const lastTrainData = [
      { depart_at: '23:50', destination: '인천' },
    ]
    const { container } = render(<SubwayLineCard {...DEFAULT_PROPS} trains={lastTrainData} />)
    expect(/\p{Extended_Pictographic}/u.test(container.textContent)).toBe(false)
  })

  // ── 핵심 정보 렌더 ───────────────────────────────────────────────────

  it('lineName 이 렌더된다', () => {
    render(<SubwayLineCard {...DEFAULT_PROPS} />)
    expect(screen.getByText('수인분당선')).toBeTruthy()
  })

  it('"다음 열차" 레이블이 렌더된다', () => {
    render(<SubwayLineCard {...DEFAULT_PROPS} />)
    expect(screen.getByText('다음 열차')).toBeTruthy()
  })

  it('열차 목적지가 렌더된다', () => {
    const { getAllByText } = render(<SubwayLineCard {...DEFAULT_PROPS} />)
    // 다음 열차(06:10)의 목적지: 인천행 (preview에도 나올 수 있으므로 getAllByText)
    expect(getAllByText(/인천행/).length).toBeGreaterThanOrEqual(1)
  })

  it('9~11px 극소 글자 클래스가 없다', () => {
    const { container } = render(<SubwayLineCard {...DEFAULT_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:9|10|11)px\]/)
  })

  it('trains 가 비어있으면 "운행 종료"를 표시한다', () => {
    render(<SubwayLineCard {...DEFAULT_PROPS} trains={[]} />)
    expect(screen.getByText('운행 종료')).toBeTruthy()
  })
})
