import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BusEtaCard from './BusEtaCard'

// AI티 금지: 9~11px 클래스, 인라인 색칩(bg-chip-*), 생색(text-slate-*, text-gray-*)
// text-micro는 밴 목록에서 제외 — DataBadge(ui/DataBadge.jsx)가 다른 화면의 배지
// (ShuttlePanel 계절학기 칩, ScheduleDetailModal 등)와 동일하게 쓰는 스케일 토큰이다.
const BANNED_CLASSES = [
  'text-[9px]', 'text-[10px]', 'text-[11px]',
  'text-meta',
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
      expect(screen.getByText('실시간 수신 중')).toBeInTheDocument()
      // 옛 문구가 남아 있으면 안 된다 (A4 카피 교체)
      expect(screen.queryByText('GBIS 도착 정보 수신 중')).not.toBeInTheDocument()
      // 첫차: 195s → eta.js floor(195/60) = 3분
      expect(screen.getByText('3분')).toBeInTheDocument()
      // 절대 시각
      expect(screen.getByText('21:01 도착 예정')).toBeInTheDocument()
      // 다음 한 대: 840s → 14분
      expect(screen.getByText('다음 한 대')).toBeInTheDocument()
      expect(screen.getByText('14분')).toBeInTheDocument()
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
      expect(screen.getByText('3분')).toBeInTheDocument()
      expect(screen.queryByText('다음 한 대')).not.toBeInTheDocument()
    })

    it('shows "곧" when primary is within the imminent threshold (90s)', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: 30, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('곧')).toBeInTheDocument()
    })

    // 회귀 방지 — 예전엔 "곧" 텍스트 임계(60초)와 빨간 강조 임계(180초)가
    // 서로 달라 "2분 후"(120~179초)가 빨갛게 떴다. 이제 텍스트/강조 둘 다
    // eta.js의 IMMINENT_THRESHOLD_SEC(90초) 하나를 쓰므로, 90초보다 큰 값은
    // 절대 강조되지 않는다.
    it('does not mark a non-imminent "N분" value as imminent (2분 회귀 방지)', () => {
      const { container } = render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: 120, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('2분')).toBeInTheDocument()
      const etaEl = screen.getByText('2분')
      expect(etaEl.className).not.toMatch(/text-imminent/)
      expect(container.innerHTML).not.toMatch(/text-imminent/)
    })

    it('음수는 곧으로 표시한다', () => {
      render(
        <BusEtaCard
          realtimeEta={{
            primary: { arrive_in_seconds: -10, arrive_at_hhmm: '21:01' },
            secondary: null,
          }}
          predictedEta={null}
        />
      )
      expect(screen.getByText('곧')).toBeInTheDocument()
    })
  })

  // 예보 오차를 문장으로 옮기지 않는다. 평균 편차가 1분도 안 되는 값을
  // "여유 있게" 같은 지시로 바꾸면 조언이 아니라 잔소리가 된다. 오차 집계는
  // 계속 쌓이지만 화면에서 말하지는 않는다.
  describe('상태 1 — 예보 오차는 화면에 쓰지 않는다', () => {
    const baseEta = {
      primary: { arrive_in_seconds: 195, arrive_at_hhmm: '21:01' },
      secondary: null,
    }

    it('eta_accuracy 가 실려 와도 아무 문구도 그리지 않는다', () => {
      const { container } = render(
        <BusEtaCard
          realtimeEta={{
            ...baseEta,
            eta_accuracy: { bias_sec: 111, mae_sec: 134, within60_ratio: 0.33, sample_size: 9491 },
          }}
          predictedEta={null}
        />
      )
      expect(container.textContent).not.toMatch(/예보보다|여유 있게|일찍 나가|들쭉날쭉/)
      // 적중률 퍼센트도 마찬가지다.
      expect(container.textContent).not.toMatch(/33%|±1분/)
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
    it('안내 문장만 렌더한다 — 자리채움 점은 두지 않는다', () => {
      render(<BusEtaCard realtimeEta={null} predictedEta={null} />)
      expect(screen.getByText('도착 정보 없음')).toBeInTheDocument()
      expect(screen.queryByText('·')).not.toBeInTheDocument()
      // prose
      expect(
        screen.getByText(/같은 요일·시간대 과거 기록도 충분하지 않아/)
      ).toBeInTheDocument()
      // 실시간/예상치 라벨이 없어야 함
      expect(screen.queryByText('실시간 수신 중')).not.toBeInTheDocument()
      expect(screen.queryByText('현재 도착 정보 없음')).not.toBeInTheDocument()
    })

    it('falls back to state 3 when both props are undefined', () => {
      render(<BusEtaCard />)
      expect(screen.getByText('도착 정보 없음')).toBeInTheDocument()
      expect(screen.queryByText('·')).not.toBeInTheDocument()
    })
  })
})
