import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import DualDirectionCard from './DualDirectionCard'

describe('DualDirectionCard', () => {
  it('normal variant: dir·route·minutes·nextMinutes를 렌더한다', () => {
    render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        sub="다음 열차"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '대곡 방면',
          minutes: 5,
          nextMinutes: 17,
        }}
        right={{
          variant: 'normal',
          dir: '↓ 하행',
          route: '원시 방면',
          minutes: 3,
          nextMinutes: 12,
          isUrgent: true,
        }}
      />
    )
    expect(screen.getByText('서해선')).toBeInTheDocument()
    expect(screen.getByText('다음 열차')).toBeInTheDocument()
    expect(screen.getByText('↑ 상행')).toBeInTheDocument()
    expect(screen.getByText('↓ 하행')).toBeInTheDocument()
    expect(screen.getByText('대곡 방면')).toBeInTheDocument()
    expect(screen.getByText('원시 방면')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('다음 17분')).toBeInTheDocument()
    expect(screen.getByText('다음 12분')).toBeInTheDocument()
  })

  it('return variant: 회차편 칩·time·설명 2줄을 렌더한다', () => {
    render(
      <DualDirectionCard
        symbol="셔"
        symbolColor="#102c4c"
        lineName="셔틀버스"
        left={{ variant: 'empty' }}
        right={{
          variant: 'return',
          dir: '↓ 하교',
          returnChipLabel: '회차편',
          time: '21:20',
          descLine1: '에 본캠에서 출발한 버스',
          descLine2: '회차탑승',
        }}
      />
    )
    expect(screen.getByText('회차편')).toBeInTheDocument()
    expect(screen.getByText('21:20')).toBeInTheDocument()
    expect(screen.getByText('에 본캠에서 출발한 버스')).toBeInTheDocument()
    expect(screen.getByText('회차탑승')).toBeInTheDocument()
    // empty 좌측 라벨
    expect(screen.getByText('운행 없음')).toBeInTheDocument()
  })

  it('frequent variant: freqLabel·freqSub을 렌더한다', () => {
    render(
      <DualDirectionCard
        symbol="셔"
        symbolColor="#102c4c"
        lineName="셔틀버스"
        left={{
          variant: 'frequent',
          dir: '↑ 등교',
          route: '본캠 → 2캠',
          freqLabel: '수시운행',
          freqSub: '약 10분 간격',
        }}
        right={{ variant: 'empty' }}
      />
    )
    expect(screen.getByText('수시운행')).toBeInTheDocument()
    expect(screen.getByText('약 10분 간격')).toBeInTheDocument()
    expect(screen.getByText('본캠 → 2캠')).toBeInTheDocument()
  })

  it('urgent일 때 box-shadow inset accent, transparent border가 적용된다', () => {
    render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '대곡 방면',
          minutes: 2,
          nextMinutes: 14,
          isUrgent: true,
        }}
        right={{ variant: 'empty' }}
        onClick={() => {}}
      />
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('data-urgent')).toBe('true')
    expect(button.style.boxShadow).toContain('inset')
    expect(button.style.border).toContain('transparent')
  })

  it('urgent가 아닐 때 border=1px solid line, box-shadow none', () => {
    render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '대곡 방면',
          minutes: 12,
          nextMinutes: 25,
        }}
        right={{ variant: 'empty' }}
        onClick={() => {}}
      />
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('data-urgent')).toBe('false')
    expect(button.style.boxShadow).toBe('none')
    expect(button.style.border).toContain('var(--tj-line)')
  })

  it('양쪽 다 empty면 "오늘 운행 없음" 통합 카드로 대체한다', () => {
    render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'empty' }}
        right={{ variant: 'empty' }}
      />
    )
    expect(screen.getByText('오늘 운행 없음')).toBeInTheDocument()
    // 좌우 분할시 사용하는 '운행 없음' 라벨은 표시하지 않음
    expect(screen.queryByText('운행 없음')).not.toBeInTheDocument()
  })

  it('onClick이 제공되면 button으로 렌더되고 클릭이 호출된다', () => {
    const handleClick = vi.fn()
    render(
      <DualDirectionCard
        symbol="수"
        symbolColor="#F5A623"
        lineName="수인분당선"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '청량리 방면',
          minutes: 4,
          nextMinutes: 14,
        }}
        right={{
          variant: 'normal',
          dir: '↓ 하행',
          route: '인천 방면',
          minutes: 8,
          nextMinutes: 20,
        }}
        onClick={handleClick}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('onClick이 없으면 button이 아닌 일반 요소로 렌더된다', () => {
    render(
      <DualDirectionCard
        symbol="4"
        symbolColor="#1B5FAD"
        lineName="4호선"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '당고개 방면',
          minutes: 6,
          nextMinutes: 16,
        }}
        right={{ variant: 'empty' }}
      />
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('4호선')).toBeInTheDocument()
  })

  it('normal variant에서 minutes=null이면 "운행 정보 없음"을 표시한다', () => {
    render(
      <DualDirectionCard
        symbol="수"
        symbolColor="#F5A623"
        lineName="수인분당선"
        left={{
          variant: 'normal',
          dir: '↑ 상행',
          route: '청량리 방면',
          minutes: null,
          nextMinutes: null,
        }}
        right={{ variant: 'empty' }}
      />
    )
    expect(screen.getByText('운행 정보 없음')).toBeInTheDocument()
  })
})
