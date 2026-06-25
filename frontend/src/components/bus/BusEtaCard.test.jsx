import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BusEtaCard from './BusEtaCard'

// AI티 금지: 9~11px 클래스, 인라인 색칩(bg-chip-*), 생색(text-slate-*, text-gray-*)
const BANNED_CLASSES = [
  'text-[9px]', 'text-[10px]', 'text-[11px]',
  'text-micro', 'text-meta',
  'bg-chip-green-bg', 'bg-chip-yellow-bg', 'bg-chip-red-bg',
  'text-slate-', 'text-gray-',
  'bg-amber-100',
]

function assertNoAiTi(container) {
  const html = container.innerHTML
  for (const cls of BANNED_CLASSES) {
    expect(html, `금지 클래스 "${cls}" 가 있으면 안 됨`).not.toContain(cls)
  }
}

describe('BusEtaCard', () => {
  describe('AI티 제거 검증', () => {
    it('실시간 상태에서 금지 클래스 없음', () => {
      const { container } = render(
        <BusEtaCard
          realtimeEta={{
            primary:   { arrive_in_seconds: 195, arrive_at_hhmm: '21:01' },
            secondary: { arrive_in_seconds: 840, arrive_at_hhmm: '21:12' },
          }}
          predictedEta={null}
        />
      )
      assertNoAiTi(container)
    })

    it('예상치 상태에서 금지 클래스 없음', () => {
      const { container } = render(
        <BusEtaCard
          realtimeEta={null}
          predictedEta={{ hhmm: '21:38', sample_size: 4, day_label: '주말' }}
        />
      )
      assertNoAiTi(container)
    })

    it('도착 정보 없음 상태에서 금지 클래스 없음', () => {
      const { container } = render(<BusEtaCard realtimeEta={null} predictedEta={null} />)
      assertNoAiTi(container)
    })
  })

  describe('상태 1 — 실시간', () => {
    it('renders primary + secondary with divider and "다음 한 대" row', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary:   { arrive_in_seconds: 195, arrive_at_hhmm: '21:01' },
            secondary: { arrive_in_seconds: 840, arrive_at_hhmm: '21:12' },
          }}
          predictedEta={null}
        />
      )
      // 실시간 pill
      expect(screen.getByText('실시간')).toBeInTheDocument()
      expect(screen.getByText('GBIS 도착 정보 수신 중')).toBeInTheDocument()
      // 첫차: 195s → ceil(195/60) = 4분 후
      expect(screen.getByText('4분 후')).toBeInTheDocument()
      // 절대 시각
      expect(screen.getByText('21:01 도착 예정')).toBeInTheDocument()
      // 다음 한 대 — 840s → 14분 후
      expect(screen.getByText('다음 한 대')).toBeInTheDocument()
      expect(screen.getByText('14분 후')).toBeInTheDocument()
    })

    it('renders only primary, no divider / secondary row, when secondary is absent', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: 195, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('4분 후')).toBeInTheDocument()
      expect(screen.queryByText('다음 한 대')).not.toBeInTheDocument()
    })

    it('shows "곧 도착" when primary < 60s', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: 30, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('곧 도착')).toBeInTheDocument()
    })

    it('shows "이미 도착" when primary < 0', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: -10, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('이미 도착')).toBeInTheDocument()
    })
  })

  describe('상태 2 — 예상치', () => {
    it('renders "보통 HH:MM쯤 도착" and prose with day_label + sample_size', () => {
      render(
        <BusEtaCard
          realtimeEta={null}
          predictedEta={{
            hhmm: '21:38',
            sample_size: 4,
            day_label: '주말',
          }}
        />
      )
      expect(screen.getByText('예상치')).toBeInTheDocument()
      expect(screen.getByText('현재 도착 정보 없음')).toBeInTheDocument()
      expect(screen.getByText('21:38')).toBeInTheDocument()
      expect(screen.getByText(/쯤 도착/)).toBeInTheDocument()
      // 새 prose: "최근 주말 4번 도착 기록"
      expect(screen.getByText('최근 주말 4번 도착 기록')).toBeInTheDocument()
      expect(screen.getByText(/중앙값이에요/)).toBeInTheDocument()
    })

    it('renders 평일 label', () => {
      render(
        <BusEtaCard
          realtimeEta={null}
          predictedEta={{ hhmm: '18:30', sample_size: 3, day_label: '평일' }}
        />
      )
      expect(screen.getByText('최근 평일 3번 도착 기록')).toBeInTheDocument()
    })

    it('falls back to generic emphasis when day_label is missing', () => {
      render(
        <BusEtaCard
          realtimeEta={null}
          predictedEta={{ hhmm: '11:00', sample_size: 3 }}
        />
      )
      expect(screen.getByText('최근 3번 도착 기록')).toBeInTheDocument()
    })
  })

  describe('상태 3 — 도착 정보 없음', () => {
    it('renders dash and prose only', () => {
      render(<BusEtaCard realtimeEta={null} predictedEta={null} />)
      expect(screen.getByText('도착 정보 없음')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
      // prose
      expect(
        screen.getByText(/같은 요일·시간대 과거 기록도 충분하지 않아/)
      ).toBeInTheDocument()
      // 실시간/예상치 라벨이 없어야 함
      expect(screen.queryByText('GBIS 도착 정보 수신 중')).not.toBeInTheDocument()
      expect(screen.queryByText('현재 도착 정보 없음')).not.toBeInTheDocument()
    })

    it('falls back to state 3 when both props are undefined', () => {
      render(<BusEtaCard />)
      expect(screen.getByText('도착 정보 없음')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })
  })
})
