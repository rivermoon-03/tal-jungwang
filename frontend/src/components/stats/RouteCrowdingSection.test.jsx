import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import RouteCrowdingSection from './RouteCrowdingSection'
import * as useCrowdingFlowModule from '../../hooks/useCrowdingFlow'

// mergeToHourly/crowdedToneStyle/isWeekendNow 순수 헬퍼 단위 테스트는
// frontend/src/utils/crowdingHeatmap.test.js에 있음(코드 위치와 동일하게 colocate).
// 이 파일은 RouteCrowdingSection의 로딩/빈/에러/정상 렌더 분기만 검증한다.

vi.mock('../../hooks/useCrowdingFlow', () => ({
  useCrowdingFlow: vi.fn(),
}))

function mockFlow(weekdayResult, weekendResult) {
  useCrowdingFlowModule.useCrowdingFlow.mockImplementation((routeNumber, dayType) => {
    if (dayType === 'weekend') return weekendResult
    return weekdayResult
  })
}

const EMPTY_RESULT = { data: null, loading: false, error: null }

const POPULATED_WEEKDAY = {
  data: {
    route_no: '시흥33',
    route_direction: '시흥시청방면',
    stop_name: '한국공학대학교',
    day_type: 'weekday',
    sample_days: 40,
    total_samples: 120,
    points: [
      { hour: 8, minute: 0, crowded: 3.2, samples: 20 },
      { hour: 8, minute: 30, crowded: 3.6, samples: 15 },
      { hour: 18, minute: 0, crowded: 1.4, samples: 10 },
    ],
  },
  loading: false,
  error: null,
}

describe('RouteCrowdingSection — 컴포넌트', () => {
  it('로딩 중이면 로딩 문구를 보여준다', () => {
    mockFlow(
      { data: null, loading: true, error: null },
      { data: null, loading: true, error: null },
    )
    render(<RouteCrowdingSection routeNumber="시흥33" />)
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument()
  })

  it('데이터가 전혀 없으면(둘 다 null) 빈 상태를 보여준다', () => {
    mockFlow(EMPTY_RESULT, EMPTY_RESULT)
    render(<RouteCrowdingSection routeNumber="시흥33" />)
    expect(screen.getByText(/아직 혼잡도 데이터가 없어요/)).toBeInTheDocument()
  })

  it('둘 다 에러면 빈 상태를 보여준다(크래시하지 않음)', () => {
    const errored = { data: null, loading: false, error: new Error('fail') }
    mockFlow(errored, errored)
    render(<RouteCrowdingSection routeNumber="시흥33" />)
    expect(screen.getByText(/아직 혼잡도 데이터가 없어요/)).toBeInTheDocument()
  })

  it('평일 데이터만 있어도 정상 렌더 — 히트맵 2행 + 지금 하이라이트', () => {
    mockFlow(POPULATED_WEEKDAY, EMPTY_RESULT)
    render(<RouteCrowdingSection routeNumber="시흥33" />)
    expect(screen.getByText('노선 혼잡도')).toBeInTheDocument()
    expect(screen.getByText('평일')).toBeInTheDocument()
    expect(screen.getByText('주말')).toBeInTheDocument()
    expect(screen.getByText(/지금\(/)).toBeInTheDocument()
    // 범례 텍스트 (색만으로 구분하지 않음)
    expect(screen.getByText('여유')).toBeInTheDocument()
    expect(screen.getByText('매우혼잡')).toBeInTheDocument()
    expect(screen.getByText('데이터 없음')).toBeInTheDocument()
  })

  it('한쪽 요청이 에러여도 다른 쪽 데이터로 렌더된다', () => {
    mockFlow(POPULATED_WEEKDAY, { data: null, loading: false, error: new Error('fail') })
    render(<RouteCrowdingSection routeNumber="시흥33" />)
    expect(screen.getByText('노선 혼잡도')).toBeInTheDocument()
  })
})
