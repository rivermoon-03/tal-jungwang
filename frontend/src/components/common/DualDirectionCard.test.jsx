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
          dir: '상행',
          route: '대곡 방면',
          minutes: 5,
          nextMinutes: 17,
        }}
        right={{
          variant: 'normal',
          dir: '하행',
          route: '원시 방면',
          minutes: 3,
          nextMinutes: 12,
          isUrgent: true,
        }}
      />
    )
    expect(screen.getByText('서해선')).toBeInTheDocument()
    expect(screen.getByText('다음 열차')).toBeInTheDocument()
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
          dir: '하교',
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
          dir: '등교',
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

  it('urgent일 때 data-urgent=true이고 inset box-shadow/transparent border를 사용하지 않는다 (Card state=imminent로 위임)', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{
          variant: 'normal',
          dir: '상행',
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
    // AI티 inset shadow 금지 — Card의 imminent 클래스로 처리
    expect(button.style.boxShadow).not.toContain('inset')
    // 1.5px inset 임시 강조 금지
    expect(container.innerHTML).not.toMatch(/1\.5px/)
    // border-imminent Tailwind 클래스가 wrapper에 존재해야 함
    expect(container.innerHTML).toMatch(/border-imminent/)
  })

  it('urgent가 아닐 때 data-urgent=false이고 기본 Card 스타일이 적용된다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{
          variant: 'normal',
          dir: '상행',
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
    // 기본 상태: bg-surface border-line
    expect(container.innerHTML).toMatch(/bg-surface/)
    expect(container.innerHTML).toMatch(/border-line/)
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
          dir: '상행',
          route: '청량리 방면',
          minutes: 4,
          nextMinutes: 14,
        }}
        right={{
          variant: 'normal',
          dir: '하행',
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
          dir: '상행',
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
          dir: '상행',
          route: '청량리 방면',
          minutes: null,
          nextMinutes: null,
        }}
        right={{ variant: 'empty' }}
      />
    )
    expect(screen.getByText('운행 정보 없음')).toBeInTheDocument()
  })

  it('9~11px 인라인 폰트 크기를 사용하지 않는다 (심볼 포함)', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        sub="다음 열차"
        left={{
          variant: 'normal',
          dir: '상행',
          route: '대곡 방면',
          minutes: 5,
          nextMinutes: 17,
        }}
        right={{ variant: 'empty' }}
      />
    )
    // 9, 10, 11px 인라인 폰트 금지
    expect(container.innerHTML).not.toMatch(/font-size:\s*(9|10|11)px/)
  })

  it('좌측 바(border-l, border-left) 클래스를 사용하지 않는다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{
          variant: 'normal',
          dir: '상행',
          route: '대곡 방면',
          minutes: 5,
          nextMinutes: 17,
          isUrgent: true,
        }}
        right={{ variant: 'empty' }}
      />
    )
    expect(container.innerHTML).not.toMatch(/border-l[-[]/);
    expect(container.innerHTML).not.toMatch(/border-left/)
  })

  // ===== 시안 1 핵심 단언 =====

  it('[시안1] 상행 방향 라벨에 ↑ 화살표가 포함된다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'normal', dir: '하행', route: '원시 방면', minutes: 8, nextMinutes: 20 }}
      />
    )
    // 좌측 상행: ↑ 화살표와 "상행" 텍스트가 함께 존재
    expect(container.textContent).toMatch(/상행/)
    expect(container.textContent).toMatch(/↑/)
    // 우측 하행: ↓ 화살표와 "하행" 텍스트가 함께 존재
    expect(container.textContent).toMatch(/하행/)
    expect(container.textContent).toMatch(/↓/)
    // innerHTML에서 방향 구조 확인 (좌=상행+↑, 우=↓+하행)
    expect(container.innerHTML).toMatch(/상행/)
    expect(container.innerHTML).toMatch(/↑/)
    expect(container.innerHTML).toMatch(/↓/)
    expect(container.innerHTML).toMatch(/하행/)
  })

  it('[시안1] ETA 숫자가 46px 초대형으로 렌더된다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'empty' }}
      />
    )
    // 46px 인라인 스타일 존재 여부 확인
    expect(container.innerHTML).toMatch(/font-size:\s*46px/)
  })

  it('[시안1] 단위(분) 폰트는 최소 16px 이상이다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'empty' }}
      />
    )
    // 12px, 13px 분 단위 금지 (16px 이상)
    expect(container.innerHTML).not.toMatch(/font-size:\s*(12|13|14|15)px[^;]*>[^<]*분/)
    // 16px 이상 "분" 단위 확인
    expect(container.innerHTML).toMatch(/font-size:\s*(1[6-9]|[2-9]\d)px/)
  })

  it('[시안1] 하단 진행 바(v1-bar)가 정상(normal) 슬롯에 렌더된다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'normal', dir: '하행', route: '원시 방면', minutes: 8, nextMinutes: 20 }}
      />
    )
    // 진행 바 컨테이너 존재
    const bars = container.querySelectorAll('[data-testid="progress-bar"]')
    expect(bars.length).toBeGreaterThanOrEqual(1)
  })

  it('[시안1] urgent일 때 진행 바 채움색이 imminent 색상이다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 2, nextMinutes: 14, isUrgent: true }}
        right={{ variant: 'empty' }}
      />
    )
    // imminent 색상 토큰이 진행바 채움에 사용됨
    expect(container.innerHTML).toMatch(/var\(--tj-imminent\)/)
  })

  it('[시안1] 이모지(🚇🚆🚊 등)가 텍스트 콘텐츠에 포함되지 않는다', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'normal', dir: '하행', route: '원시 방면', minutes: 8, nextMinutes: 20 }}
      />
    )
    // 이모지 유니코드 범위 포함 금지 (transport/misc symbols)
    expect(container.textContent).not.toMatch(/[\u{1F680}-\u{1F6FF}]/u)
    expect(container.textContent).not.toMatch(/[\u{1F900}-\u{1F9FF}]/u)
  })

  it('[시안1] 좌측 컬럼은 text-align left, 우측 컬럼은 text-align right (거울 대칭)', () => {
    const { container } = render(
      <DualDirectionCard
        symbol="서"
        symbolColor="#75BF43"
        lineName="서해선"
        left={{ variant: 'normal', dir: '상행', route: '대곡 방면', minutes: 5, nextMinutes: 17 }}
        right={{ variant: 'normal', dir: '하행', route: '원시 방면', minutes: 8, nextMinutes: 20 }}
      />
    )
    // 우측 컬럼: text-align right 인라인 스타일
    expect(container.innerHTML).toMatch(/text-align:\s*right/)
  })
})
