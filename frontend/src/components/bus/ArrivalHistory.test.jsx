import { render, screen } from '@testing-library/react'
import ArrivalHistory from './ArrivalHistory'

// rows shape: [{ key, items: [{ time, position }] }] — utils/historyAdapter.toHistoryRows 반환값

const sampleRows = [
  {
    key: 'yesterday',
    items: [
      { time: '07:15', position: 'past' },
      { time: '07:30', position: 'past' },
      { time: '07:45', position: 'closest' },
      { time: '08:00', position: 'after' },
      { time: '08:15', position: 'after' },
      { time: '08:30', position: 'after' },
    ],
  },
  {
    key: 'dayBefore',
    items: [
      { time: '07:16', position: 'past' },
      { time: '07:32', position: 'closest' },
      { time: '07:48', position: 'after' },
    ],
  },
  {
    key: 'lastWeek',
    items: [
      { time: '07:44', position: 'closest' },
    ],
  },
]

describe('ArrivalHistory', () => {
  describe('컬럼 헤더', () => {
    it('오늘 헤더가 없다 (오늘 컬럼 제거)', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText('오늘')).toBeNull()
    })

    it('어제/이틀 전/7일 전 헤더가 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText('어제')).toBeInTheDocument()
      expect(screen.getByText('이틀 전')).toBeInTheDocument()
      expect(screen.getByText('7일 전')).toBeInTheDocument()
    })

    it('columnLabels prop이 주어지면 해당 라벨을 사용한다', () => {
      const labels = { yesterday: '6/24(수)', dayBefore: '6/23(화)', lastWeek: '6/18(수)' }
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" columnLabels={labels} />)
      expect(screen.getByText('6/24(수)')).toBeInTheDocument()
      expect(screen.getByText('6/23(화)')).toBeInTheDocument()
      expect(screen.getByText('6/18(수)')).toBeInTheDocument()
    })
  })

  describe('rows 렌더 (컬럼별 최대 6건 윈도우)', () => {
    it('각 컬럼의 도착 시각을 모두 렌더한다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText('07:15')).toBeInTheDocument()
      expect(screen.getByText('08:30')).toBeInTheDocument()
      expect(screen.getByText('07:16')).toBeInTheDocument()
      expect(screen.getByText('07:44')).toBeInTheDocument()
    })

    it('yesterday 컬럼처럼 6건까지도 렌더할 수 있다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      // yesterday 컬럼의 6개 시각이 모두 존재
      ;['07:15', '07:30', '07:45', '08:00', '08:15', '08:30'].forEach((t) => {
        expect(screen.getByText(t)).toBeInTheDocument()
      })
    })

    it('closest position은 "지금과 비슷" 라벨을 렌더한다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const closestLabels = screen.getAllByText('지금과 비슷')
      // sampleRows에는 컬럼마다 closest 1개씩 총 3개
      expect(closestLabels.length).toBe(3)
    })

    it('past/after position은 "도착함" 라벨을 렌더한다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const arrivedLabels = screen.getAllByText('도착함')
      // 전체 items 10개 중 closest 3개를 제외한 7개
      expect(arrivedLabels.length).toBe(7)
    })
  })

  describe('closest 강조 스타일', () => {
    it('closest 셀은 accent 배지 클래스를 갖는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const closestCell = screen.getByText('07:45').parentElement
      expect(closestCell.className).toMatch(/bg-accent-bg/)
      expect(closestCell.className).toMatch(/text-accent-ink/)
    })

    it('past 셀은 opacity 클래스를 갖는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const pastCell = screen.getByText('07:15').parentElement
      expect(pastCell.className).toMatch(/opacity-35/)
    })
  })

  describe('delta verdict 제거', () => {
    it('"분 빠름" 텍스트가 없다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/분 빠름/)).toBeNull()
    })

    it('"분 늦음" 텍스트가 없다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/분 늦음/)).toBeNull()
    })

    it('"오늘은 어제보다" verdict 박스가 없다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/오늘은 어제보다/)).toBeNull()
    })
  })

  describe('하단 안내문', () => {
    it('과거 도착 시각을 참고해 직접 가늠 안내문이 정확히 1회만 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const matches = screen.getAllByText(/과거 도착 시각을 참고해 직접 가늠/)
      expect(matches.length).toBe(1)
    })

    it('안내문에 현재 시각이 병기된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const el = screen.getByText(/과거 도착 시각을 참고해 직접 가늠/)
      expect(el.textContent).toMatch(/현재 \d{2}:\d{2}/)
    })

    it('"이전 시간을 기반으로 한 예정치" 문구가 없다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/이전 시간을 기반으로 한 예정치/)).toBeNull()
    })

    it('안내문이 rows가 없을 때는 렌더되지 않는다', () => {
      render(<ArrivalHistory rows={[]} routeNumber="33" />)
      expect(screen.queryByText(/과거 도착 시각을 참고해/)).toBeNull()
    })
  })

  describe('빈 데이터 EmptyState', () => {
    it('rows가 빈 배열이면 EmptyState를 렌더한다', () => {
      render(<ArrivalHistory rows={[]} routeNumber="33" />)
      expect(screen.getByText(/아직 도착 기록이 충분하지 않아요/)).toBeInTheDocument()
    })

    it('rows가 null이면 EmptyState를 렌더한다', () => {
      render(<ArrivalHistory rows={null} routeNumber="33" />)
      expect(screen.getByText(/아직 도착 기록이 충분하지 않아요/)).toBeInTheDocument()
    })

    it('rows가 undefined이면 EmptyState를 렌더한다', () => {
      render(<ArrivalHistory routeNumber="33" />)
      expect(screen.getByText(/아직 도착 기록이 충분하지 않아요/)).toBeInTheDocument()
    })
  })

  describe('금지 규칙 검증', () => {
    it('12px 미만 텍스트 클래스가 없어야 한다 (시각 >= 13px)', () => {
      const { container } = render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const allClasses = Array.from(container.querySelectorAll('[class]'))
        .map((el) => el.className)
        .join(' ')
      expect(allClasses).not.toMatch(/text-\[(9|10|11)px\]/)
      expect(allClasses).not.toMatch(/\btext-micro\b/)
      expect(allClasses).not.toMatch(/\btext-meta\b/)
      expect(allClasses).not.toMatch(/\btext-sub\b/)
    })

    it('좌측 색상 테두리 클래스가 없어야 한다', () => {
      const { container } = render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const allClasses = Array.from(container.querySelectorAll('[class]'))
        .map((el) => el.className)
        .join(' ')
      expect(allClasses).not.toMatch(/border-l-\d/)
    })

    it('이모지가 없어야 한다', () => {
      const { container } = render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const text = container.textContent
      expect(text).not.toMatch(/[\u{1F300}-\u{1FFFF}]/u)
    })

    it('임의 hex 색상(#hex) 클래스/스타일이 없어야 한다', () => {
      const { container } = render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const html = container.innerHTML
      expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    })
  })

  describe('헤더 중복 제거', () => {
    it('"같은 시각, 며칠을 나란히" 중복 헤더를 렌더하지 않는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/같은 시각, 며칠을 나란히/)).toBeNull()
    })
  })
})
