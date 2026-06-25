import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import BusArrivalCard from './BusArrivalCard'

// useFavorites 의존성 차단
vi.mock('../../hooks/useFavorites', () => ({
  default: () => ({ isFavorite: false, toggle: vi.fn() }),
}))

const baseRealtime = (over = {}) => ({
  route_no: '5200',
  route_id: 200,
  destination: '신도림',
  category: '하교',
  arrival_type: 'realtime',
  arrive_in_seconds: 180,
  ...over,
})

describe('BusArrivalCard — 재설계 layout', () => {
  // ─── 금지 항목 ───────────────────────────────────────────────────────────────

  it('border-l 클래스(좌측 색상 테두리)가 없다', () => {
    const { container } = render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    // border-l- 로 시작하는 모든 클래스가 없어야 함
    expect(container.innerHTML).not.toMatch(/\bborder-l-/)
  })

  it('"에서 출발" uppercase 영문식 텍스트가 없다', () => {
    render(<BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />)
    expect(screen.queryByText('에서 출발')).not.toBeInTheDocument()
  })

  it('uppercase 자간 강제 클래스(tracking-[.04em] uppercase 조합)가 없다', () => {
    const { container } = render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    // 영문식 스타일: uppercase + 넓은 자간 조합 금지
    expect(container.innerHTML).not.toMatch(/uppercase.*tracking-\[\.0[4-9]/)
  })

  it('9px~11px 글자 크기 클래스가 없다 (text-[9px], text-[10px], text-[11px])', () => {
    const { container } = render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    expect(container.innerHTML).not.toMatch(/text-\[9(\.5)?px\]/)
    expect(container.innerHTML).not.toMatch(/text-\[10px\]/)
    expect(container.innerHTML).not.toMatch(/text-\[11px\]/)
  })

  // ─── ETA formatEta(floor) 정책 ───────────────────────────────────────────────

  it('239초 → "3분" (floor 정책, ceil이면 4분)', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 239 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.queryByText('4')).not.toBeInTheDocument()
  })

  it('180초 → "3분"', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 180 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('600초 (>90) → "10분"', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 600 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  // ─── 임박(≤90초) ─────────────────────────────────────────────────────────────

  it('30초 → "곧" (imminent)', () => {
    const { container } = render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 30 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('곧')).toBeInTheDocument()
    const eta = container.querySelector('[data-eta]')
    expect(eta.className).toMatch(/imminent/)
  })

  it('90초 → "곧" (formatEta 임박 임계값)', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 90 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('곧')).toBeInTheDocument()
  })

  it('91초 → 숫자 분(1분)', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 91 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.queryByText('곧')).not.toBeInTheDocument()
  })

  // ─── 노선번호 렌더 ────────────────────────────────────────────────────────────

  it('노선번호(5200)가 렌더된다', () => {
    render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    expect(screen.getByText('5200')).toBeInTheDocument()
  })

  // ─── 행선지·출발지 ────────────────────────────────────────────────────────────

  it('행선지 head label이 렌더된다 (신도림행)', () => {
    render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    expect(screen.getByText('신도림행')).toBeInTheDocument()
  })

  it('한국어 출발지 텍스트가 자연스럽게 표시된다 (출발, 경유 형식)', () => {
    render(
      <BusArrivalCard arrivals={[baseRealtime()]} stationId="x" onTimetableClick={() => {}} />
    )
    // "에서 출발"은 금지 — 자연스러운 한국어(예: "시화터미널 출발") 형식으로
    const text = document.body.textContent
    expect(text).not.toMatch(/에서 출발/)
  })

  // ─── 특수 상태 ────────────────────────────────────────────────────────────────

  it('arrivals 없으면(arrive_in_seconds null) "—" 표시', () => {
    render(
      <BusArrivalCard
        arrivals={[{ route_no: '11-A', route_id: 11, destination: '정왕역', category: '하교', arrival_type: 'realtime' }]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('arrive_in_seconds <= 0 버스는 건너뛰고 다음 버스를 primary로', () => {
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({ arrive_in_seconds: 0 }),   // 이미 출발
          baseRealtime({ arrive_in_seconds: 600 }), // 다음 차 → primary
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.queryByText('곧')).not.toBeInTheDocument()
  })

  it('모든 arrival이 <=0이면 "—" 표시', () => {
    render(
      <BusArrivalCard
        arrivals={[baseRealtime({ arrive_in_seconds: 0 })]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('stats.tolerance_min 있을 때 "보통 ±N분" 표시', () => {
    render(
      <BusArrivalCard
        arrivals={[
          baseRealtime({
            arrive_in_seconds: 180,
            stats: { tolerance_min: 4, p10_min: 1, p50_min: 4, p90_min: 9, mean_min: 4, sample_size: 28 },
          }),
        ]}
        stationId="x"
        onTimetableClick={() => {}}
      />
    )
    expect(screen.getByText(/보통 ±4분/)).toBeInTheDocument()
  })

  it('두 번째 버스가 있으면 "다음 HH:MM" 절대시각 표시', () => {
    const fixedNow = new Date('2026-05-16T21:00:00+09:00')
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
    try {
      render(
        <BusArrivalCard
          arrivals={[
            baseRealtime({ arrive_in_seconds: 180 }),
            baseRealtime({ arrive_in_seconds: 540 }),
          ]}
          stationId="x"
          onTimetableClick={() => {}}
        />
      )
      // 21:00 + 540s = 21:09
      expect(screen.getByText(/다음 21:09/)).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
