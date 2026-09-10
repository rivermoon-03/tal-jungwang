import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import BusStatsHeader from './BusStatsHeader'

// AI티 금지: 9~11px 클래스, bg-amber-100 배지, 생색
// ArrivalDistributionBar는 이번 범위 밖 — 해당 컴포넌트 행 제외하고 BusStatsHeader 자체만 체크
const BANNED_CLASSES = [
  'text-[9px]', 'text-[11px]',
  'text-micro', 'text-meta',
  'bg-amber-100', 'bg-amber-900',
  'text-amber-700', 'text-amber-300',
  'text-slate-', 'text-gray-',
]

function assertNoAiTiHeader(container) {
  // ArrivalDistributionBar를 제외한 BusStatsHeader 자체 요소만 검사
  // (헤더 div, ETA 숫자, subtitle, 하단 설명 행)
  const root = container.firstChild
  if (!root) return
  // 첫 번째 flex 행 (타이틀 + subtitle)
  const topRow = root.querySelector('.flex.items-end.justify-between')
  // 하단 설명 행
  const bottomRow = root.querySelector('.mt-2.flex.items-center.justify-between')

  for (const el of [topRow, bottomRow].filter(Boolean)) {
    const html = el.outerHTML
    for (const cls of BANNED_CLASSES) {
      expect(html, `금지 클래스 "${cls}" 가 있으면 안 됨`).not.toContain(cls)
    }
  }
}

describe('BusStatsHeader', () => {
  describe('AI티 제거 검증', () => {
    it('기본 렌더에서 금지 클래스 없음', () => {
      const { container } = render(
        <BusStatsHeader
          stats={{
            p10_min: 1, p50_min: 4, p90_min: 9,
            mean_min: 4, sample_size: 28,
          }}
          dayLabel="평일"
          hourLabel="18시"
        />
      )
      assertNoAiTiHeader(container)
    })

    it('is_low_sample=true 면 기록이 적다고 밝힌다', () => {
      const { container } = render(
        <BusStatsHeader
          stats={{
            p10_min: 1, p50_min: 4, p90_min: 9,
            mean_min: 4, sample_size: 3, is_low_sample: true,
          }}
        />
      )
      assertNoAiTiHeader(container)
      expect(container.textContent).toContain('기록 적음')
    })
  })

  it('returns null when stats is null', () => {
    const { container } = render(<BusStatsHeader stats={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when stats is undefined', () => {
    const { container } = render(<BusStatsHeader />)
    expect(container.firstChild).toBeNull()
  })

  // 예전에는 "약 4분"(평균)을 큰 숫자로 놓고 아래 막대에 1/4/9 를 함께 그렸다.
  // 평균은 막대의 어느 값과도 달라 사용자가 출처를 알 수 없었다.
  it('대표값 하나가 아니라 범위로 말한다', () => {
    render(
      <BusStatsHeader
        stats={{
          p10_min: 1,
          p50_min: 4,
          p90_min: 9,
          mean_min: 4,
          tolerance_min: 4,
          sample_size: 28,
        }}
        dayLabel="평일"
        hourLabel="18시"
      />
    )
    expect(screen.queryByText(/약 4분/)).not.toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText(/한 대를 놓치면 최대 9분/)).toBeInTheDocument()
    expect(screen.getByText(/평일 · 18시/)).toBeInTheDocument()
    expect(screen.getByText(/최근 28번 기록/)).toBeInTheDocument()
    expect(screen.getByText(/보통 4분/)).toBeInTheDocument()
  })

  it('p10 p90 표본 같은 개발 용어를 화면에 쓰지 않는다', () => {
    const { container } = render(
      <BusStatsHeader
        stats={{ p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 }}
      />
    )
    expect(container.textContent).not.toMatch(/p10|p90|표본/)
  })
})
