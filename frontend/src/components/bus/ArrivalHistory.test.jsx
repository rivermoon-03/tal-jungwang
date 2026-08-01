import { describe, it, expect } from 'vitest'
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

const sampleColumns = [
  { times: ['07:15', '07:30', '07:45', '08:00', '08:15', '08:30'] },
  { times: ['07:16', '07:32', '07:48'] },
  { times: ['07:44'] },
]

describe('ArrivalHistory', () => {
  describe('컬럼 헤더', () => {
    it('오늘 헤더가 없다 (오늘 컬럼 제거)', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText('오늘')).toBeNull()
    })

    it('지난주/2주 전/3주 전 헤더가 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText('지난주')).toBeInTheDocument()
      expect(screen.getByText('2주 전')).toBeInTheDocument()
      expect(screen.getByText('3주 전')).toBeInTheDocument()
    })

    it('columnLabels prop이 주어지면 해당 라벨을 사용한다', () => {
      const labels = { yesterday: '6/24(수)', dayBefore: '6/23(화)', lastWeek: '6/18(수)' }
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" columnLabels={labels} />)
      expect(screen.getByText('6/24(수)')).toBeInTheDocument()
      expect(screen.getByText('6/23(화)')).toBeInTheDocument()
      expect(screen.getByText('6/18(수)')).toBeInTheDocument()
    })
  })

  describe('섹션 헤더 — 왜 이 3일인지 설명(결함 #30)', () => {
    it('"이 시간대 실제 도착" 헤더가 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText('이 시간대 실제 도착')).toBeInTheDocument()
    })

    it('같은 요일 3주치라는 설명이 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText(/오늘과 같은 요일 최근 3주 기록/)).toBeInTheDocument()
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

    it('"도착함" 라벨을 렌더하지 않는다 (결함 #30 — 12회 반복 제거)', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText('도착함')).toBeNull()
    })
  })

  describe('과거/미래 구분 — 잉크 2단(결함 #30, 유령 글씨 금지)', () => {
    it('closest 셀은 accent 배지 클래스를 갖는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const closestCell = screen.getByText('07:45').parentElement
      expect(closestCell.className).toMatch(/bg-accent-bg/)
      expect(closestCell.className).toMatch(/text-accent-ink/)
    })

    it('past 셀은 opacity가 아니라 ink-2 톤 클래스를 갖는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const pastCell = screen.getByText('07:15')
      expect(pastCell.className).toMatch(/text-ink-2/)
      expect(pastCell.className).not.toMatch(/opacity-/)
    })

    it('after 셀은 기본 ink 톤 클래스를 갖는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const afterCell = screen.getByText('08:00')
      expect(afterCell.className).toMatch(/\btext-ink\b/)
    })

    it('opacity 클래스가 문서 전체에 없다(유령 글씨 금지)', () => {
      const { container } = render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const allClasses = Array.from(container.querySelectorAll('[class]'))
        .map((el) => el.className)
        .join(' ')
      expect(allClasses).not.toMatch(/opacity-\d/)
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

  describe('하단 결론 — 기록 기반 배차 간격(결함 #30)', () => {
    it('columns가 있고 now 근처 간격을 계산할 수 있으면 "N~M분 간격" 문장을 렌더한다', () => {
      const now = new Date('2026-08-01T07:40:00')
      render(
        <ArrivalHistory
          rows={sampleRows}
          routeNumber="33"
          columns={sampleColumns}
          dayLabel="토요일"
          now={now}
        />
      )
      expect(screen.getByText(/토요일 이 시간대엔 보통/)).toBeInTheDocument()
      expect(screen.getByText(/분 간격/)).toBeInTheDocument()
    })

    it('columns가 없으면 계산 불가 안내 문구로 대체된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText(/과거 도착 시각을 참고해 직접 가늠해보세요/)).toBeInTheDocument()
    })

    it('"이전 시간을 기반으로 한 예정치" 문구가 없다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/이전 시간을 기반으로 한 예정치/)).toBeNull()
    })

    it('결론 문장이 rows가 없을 때는 렌더되지 않는다', () => {
      render(<ArrivalHistory rows={[]} routeNumber="33" />)
      expect(screen.queryByText(/과거 도착 시각을 참고해/)).toBeNull()
      expect(screen.queryByText(/분 간격/)).toBeNull()
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
      expect(allClasses).not.toMatch(/text-\[(9|10|11)(\.\d+)?px\]/)
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

    it('em-dash(—)가 렌더 텍스트에 없어야 한다', () => {
      const { container } = render(
        <ArrivalHistory rows={sampleRows} routeNumber="33" columns={sampleColumns} dayLabel="평일" />
      )
      expect(container.textContent).not.toMatch(/—/)
    })
  })

  describe('헤더 중복 제거', () => {
    it('"같은 시각, 며칠을 나란히" 중복 헤더를 렌더하지 않는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/같은 시각, 며칠을 나란히/)).toBeNull()
    })
  })
})
