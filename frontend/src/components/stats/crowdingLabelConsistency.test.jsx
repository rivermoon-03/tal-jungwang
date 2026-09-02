/**
 * 혼잡도 라벨 일관성 회귀 테스트.
 *
 * 배경: StatusChips는 utils/crowdingLevel.labelFromRatio(정본)를 쓰는데
 * CrowdingCard는 한때 utils/crowdingPalette.crowdedLabel(구버전, 평균 기준)을
 * 써서, 같은 화면 안에서 같은 노선이 "보통"이자 "붐빔"으로 동시에 보였다.
 * 이 파일은 같은 입력(ratio/estimated/reliable)에 대해 두 컴포넌트가
 * 항상 같은 라벨 문자열을 렌더하는지 고정한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import StatusChips from './StatusChips'
import CrowdingCard from './CrowdingCard'
import * as useCrowdingFlowModule from '../../hooks/useCrowdingFlow'
import * as useWeatherModule from '../../hooks/useWeather'
import * as useTrafficLiveModule from '../../hooks/useTrafficLive'

vi.mock('../../hooks/useCrowdingFlow', () => ({
  useCrowdingFlow: vi.fn(),
}))
vi.mock('../../hooks/useWeather', () => ({
  useWeather: vi.fn(),
}))
vi.mock('../../hooks/useTrafficLive', () => ({
  useTrafficLive: vi.fn(),
}))

// 시흥33 하교 17시 실측 사례(감사 보고서 원인) — 혼잡(≥3) 비율 46.6%.
// 평균(crowded=2.1, "보통" 근처)과 비율(ratio=0.466, "매우 붐빔") 축이 갈라지는
// 지점이라 두 컴포넌트가 실제로 같은 함수를 타는지 검증하기에 적합하다.
const CROWD_DATA = {
  points: [
    { hour: 8, minute: 0, crowded: 2.1, ratio: 0.466, samples: 30, estimated: false, reliable: true },
  ],
}

describe('혼잡도 라벨 일관성 — StatusChips vs CrowdingCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // 2026-09-02(수, 평일) 08:10 KST — points의 8시 버킷과 맞춘다.
    vi.setSystemTime(new Date('2026-09-02T08:10:00+09:00'))
    useWeatherModule.useWeather.mockReturnValue({ weather: null })
    useTrafficLiveModule.useTrafficLive.mockReturnValue({ road: null })
    useCrowdingFlowModule.useCrowdingFlow.mockReturnValue({ data: CROWD_DATA, loading: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('같은 시각·같은 노선 데이터에 대해 두 컴포넌트가 같은 라벨을 보여준다', () => {
    const { unmount } = render(<StatusChips />)
    expect(screen.getByText('매우 붐빔')).toBeInTheDocument()
    unmount()

    render(<CrowdingCard />)
    expect(screen.getByText('매우 붐빔')).toBeInTheDocument()
  })

  it('CrowdingCard가 더 이상 평균(crowded) 기준 구버전 라벨을 쓰지 않는다', () => {
    // crowdedLabel(2.1)이면 "보통"이 나왔을 것 — 정본 함수(labelFromRatio)를
    // 쓰면 ratio=0.466 기준 "매우 붐빔"이 나와야 한다.
    //
    // "지금" 상태 표시 영역만 본다 — CrowdingChart가 항상 보이는 4단계 색 범례
    // (여유/보통/혼잡/매우혼잡)를 차트 아래 함께 그리므로, 문서 전체에서 '보통'
    // 문자열의 존재/부재만으로는 판정할 수 없다(범례는 정상적으로 '보통'을 포함한다).
    render(<CrowdingCard />)
    const nowValue = screen.getByText('지금').nextElementSibling
    expect(nowValue).not.toHaveTextContent('보통')
    expect(nowValue).toHaveTextContent('매우 붐빔')
  })
})
