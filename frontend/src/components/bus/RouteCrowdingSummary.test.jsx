/**
 * RouteCrowdingSummary — 히트맵 범례 회귀 테스트.
 *
 * 히트맵 셀의 색 의미가 title= HTML 툴팁에만 있으면 모바일 터치에서는 확인할
 * 방법이 없다(hover 전제). 펼침 상태에서 화면에 상시 보이는 텍스트 범례가
 * 실제로 렌더되는지 고정한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RouteCrowdingSummary from './RouteCrowdingSummary'
import * as useCrowdingFlowModule from '../../hooks/useCrowdingFlow'

vi.mock('../../hooks/useCrowdingFlow', () => ({
  useCrowdingFlow: vi.fn(),
}))

// 시흥33 하교 실측 패턴(16~19시) — 시간대별 차이가 커서 hasVariance=true가 되고
// "시간대별 자세히 보기" 버튼(히트맵)이 노출된다.
const VARIANT_FLOW = {
  data: {
    stop_name: '한국공학대학교',
    total_samples: 200,
    points: [
      { hour: 16, minute: 0, ratio: 0.089, samples: 50, estimated: false, reliable: true },
      { hour: 17, minute: 0, ratio: 0.466, samples: 50, estimated: false, reliable: true },
      { hour: 18, minute: 0, ratio: 0.308, samples: 50, estimated: false, reliable: true },
      { hour: 19, minute: 0, ratio: 0.004, samples: 50, estimated: false, reliable: true },
    ],
  },
  loading: false,
  error: null,
}

describe('RouteCrowdingSummary — 히트맵 범례', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-09-02(수, 평일) 20시 — 표본 시간대(16~19시) 밖이라 nowLabel 계산과
    // 무관하게 hasVariance 분기만 안정적으로 검증한다.
    vi.setSystemTime(new Date('2026-09-02T20:00:00+09:00'))
    useCrowdingFlowModule.useCrowdingFlow.mockReturnValue(VARIANT_FLOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('펼치기 전에는 범례가 보이지 않는다', () => {
    render(<RouteCrowdingSummary routeNumber="시흥33" />)
    expect(screen.queryByText('붐빔')).not.toBeInTheDocument()
  })

  it('시간대별 자세히 보기를 펼치면 범례 텍스트가 상시 렌더된다(title 툴팁이 아니라 화면 텍스트로)', () => {
    render(<RouteCrowdingSummary routeNumber="시흥33" />)

    fireEvent.click(screen.getByRole('button', { name: '시간대별 자세히 보기' }))

    expect(screen.getByText('여유')).toBeInTheDocument()
    expect(screen.getByText('보통')).toBeInTheDocument()
    expect(screen.getByText('붐빔')).toBeInTheDocument()
    expect(screen.getByText('매우 붐빔')).toBeInTheDocument()
    expect(screen.getByText('데이터 없음')).toBeInTheDocument()
  })
})
