import { render, screen } from '@testing-library/react'
import ArrivalHistory from './ArrivalHistory'

// 변경 후: today=null(예정 미표시) / delta 없음 / 오늘 컬럼 제거 / 어제·이틀전·7일전 3컬럼

const sampleRows = [
  {
    slot: '07:43',
    yesterday: '07:45',
    dayBefore: '07:42',
    lastWeek: '07:44',
    delta: null,
  },
  {
    slot: '07:58',
    yesterday: '07:58',
    dayBefore: '07:55',
    lastWeek: '07:59',
    delta: null,
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

  describe('rows 렌더 (어제 / 이틀 전 / 7일 전 비교)', () => {
    it('어제/이틀 전/7일 전 도착 시각을 렌더한다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText('07:45')).toBeInTheDocument()
      expect(screen.getByText('07:42')).toBeInTheDocument()
      expect(screen.getByText('07:44')).toBeInTheDocument()
      expect(screen.getByText('07:58')).toBeInTheDocument()
      expect(screen.getByText('07:55')).toBeInTheDocument()
      expect(screen.getByText('07:59')).toBeInTheDocument()
    })

    it('각 셀에 "도착함" 라벨을 렌더한다 (3컬럼 × N행)', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      const labels = screen.getAllByText('도착함')
      expect(labels.length).toBe(sampleRows.length * 3)
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
    it('과거 도착 시각을 참고해 직접 가늠 안내문이 렌더된다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.getByText(/과거 도착 시각을 참고해 직접 가늠/)).toBeInTheDocument()
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
  })

  describe('헤더 중복 제거', () => {
    it('"같은 시각, 며칠을 나란히" 중복 헤더를 렌더하지 않는다', () => {
      render(<ArrivalHistory rows={sampleRows} routeNumber="33" />)
      expect(screen.queryByText(/같은 시각, 며칠을 나란히/)).toBeNull()
    })
  })
})
