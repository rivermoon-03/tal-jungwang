/**
 * MealGridSection 테스트
 *
 * 시안 반영 확인:
 *  - 메뉴 항목은 격자 타일이 아니라 태그 칩(rounded-pill)이다. 최대 6개, 넘으면 +N.
 *  - 앞의 두 항목을 "대표메뉴"로 강조하던 임의 로직(isMain = i < 2)을 없앴다 —
 *    백엔드 by_day 순서가 보장되지 않아 "김치"·"단무지"가 대표로 뜨는 문제가 있었다.
 *  - "지금 운영중" 배지는 카드 상단 경계에 걸치도록 절대배치되고, 카드에는
 *    2px 액센트 링(box-shadow)이 둘린다.
 *  - 실시간 상태 pill(영업 중/운영 종료)과 하단 부가정보는 showLiveStatus가
 *    true(오늘을 보고 있을 때)일 때만 계산한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MealGridSection from './MealGridSection'

describe('MealGridSection', () => {
  // --- 메뉴 태그화 ---
  it('메뉴 항목을 rounded-pill 태그 칩으로 렌더한다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['비빔밥', '된장찌개', '김치'] } }
    render(<MealGridSection meal={meal} dayKey="2" />)

    const tag = screen.getByText('비빔밥')
    expect(tag).toHaveClass('rounded-pill')
    expect(screen.getByText('된장찌개')).toHaveClass('rounded-pill')
    expect(screen.getByText('김치')).toHaveClass('rounded-pill')
  })

  it('메뉴 태그가 6개를 넘으면 나머지를 "+N"으로 뭉친다', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': items } }
    render(<MealGridSection meal={meal} dayKey="2" />)

    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('f')).toBeInTheDocument()
    expect(screen.queryByText('g')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
  })

  // --- 임의 강조 제거 ---
  it('메뉴 항목 앞 두 개를 더 이상 강조하지 않는다(모든 태그가 같은 스타일)', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['첫메뉴', '둘째메뉴', '김치', '단무지'] } }
    render(<MealGridSection meal={meal} dayKey="2" />)

    const first = screen.getByText('첫메뉴')
    const second = screen.getByText('둘째메뉴')
    const third = screen.getByText('김치')

    // 예전 시안에서 앞 2개에 붙던 강조 클래스가 어디에도 없어야 한다.
    ;[first, second, third].forEach((el) => {
      expect(el.className).not.toContain('bg-accent-bg')
      expect(el.className).not.toContain('text-accent')
    })
    // 순서와 무관하게 모든 태그가 같은 클래스를 공유한다(순서에 의미를 두지 않는다).
    expect(first.className).toBe(second.className)
    expect(second.className).toBe(third.className)
  })

  // --- 지금 운영중 배지 위치 ---
  it('isNowOpen이면 카드 상단에 걸치는 절대배치 "지금 운영중" 배지를 보여준다', () => {
    const meal = { type: '조식', time: '8:30~10:00', by_day: { '2': ['①코너 김치볶음밥&계란후라이'] } }
    render(<MealGridSection meal={meal} dayKey="2" isNowOpen showLiveStatus />)

    const badge = screen.getByText('지금 운영중')
    const badgeWrap = badge.parentElement
    expect(badgeWrap.className).toContain('absolute')
    expect(badgeWrap.className).toContain('-top-3')
  })

  it('isNowOpen이면 카드에 2px 액센트 링(box-shadow)을 두른다', () => {
    const meal = { type: '조식', time: '8:30~10:00', by_day: { '2': ['①코너 김치볶음밥&계란후라이'] } }
    const { container } = render(<MealGridSection meal={meal} dayKey="2" isNowOpen showLiveStatus />)
    const card = container.firstChild
    expect(card.style.boxShadow).toContain('2px')
    expect(card.style.boxShadow).toContain('var(--tj-accent)')
  })

  it('isNowOpen이 아니면 "지금 운영중" 배지를 보여주지 않는다', () => {
    const meal = { type: '조식', time: '8:30~10:00', by_day: { '2': ['①코너 김치볶음밥&계란후라이'] } }
    render(<MealGridSection meal={meal} dayKey="2" isNowOpen={false} showLiveStatus />)
    expect(screen.queryByText('지금 운영중')).not.toBeInTheDocument()
  })

  // --- 실시간 상태 pill ---
  it('showLiveStatus가 true면 운영 상태 pill(영업 중/운영 종료)을 보여준다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['에비동/제육볶음면'] } }
    const { rerender } = render(<MealGridSection meal={meal} dayKey="2" isNowOpen showLiveStatus />)
    expect(screen.getByText('영업 중')).toBeInTheDocument()

    rerender(<MealGridSection meal={meal} dayKey="2" isNowOpen={false} showLiveStatus />)
    expect(screen.getByText('운영 종료')).toBeInTheDocument()
  })

  it('showLiveStatus가 false면 오늘이 아니므로 상태 pill을 보여주지 않는다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['비빔밥'] } }
    render(<MealGridSection meal={meal} dayKey="2" isNowOpen showLiveStatus={false} />)
    expect(screen.queryByText('영업 중')).not.toBeInTheDocument()
    expect(screen.queryByText('운영 종료')).not.toBeInTheDocument()
  })

  // --- 결함 #9: 별표 메타 표기 ---
  it('별표로 감싼 메타 표기(*복수메뉴* 등)는 태그로 그리지 않는다', () => {
    const meal = {
      type: '중식',
      time: '11:00~14:00',
      by_day: { '2': ['*복수메뉴*', '에비동/제육볶음면', '무채국'] },
    }
    render(<MealGridSection meal={meal} dayKey="2" />)

    expect(screen.queryByText('*복수메뉴*')).not.toBeInTheDocument()
    expect(screen.getByText('에비동/제육볶음면')).toBeInTheDocument()
    expect(screen.getByText('무채국')).toBeInTheDocument()
  })

  it('메타 표기만 있고 실제 메뉴가 없으면 미운영과 같이 안내 문구를 보여준다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['*복수메뉴*'] } }
    render(<MealGridSection meal={meal} dayKey="2" />)

    expect(screen.getByText(/운영하지 않아요/)).toBeInTheDocument()
    expect(screen.queryByTestId('menu-tags')).not.toBeInTheDocument()
  })

  // --- 결함 #10: 코너 라벨이 메뉴처럼 뜨는 문제 ---
  it('코너 라벨은 뒤따르는 메뉴에 묶인 하나의 태그로만 보이고, 라벨만 단독으로는 뜨지 않는다', () => {
    const meal = {
      type: '천원의 아침밥',
      time: '8:30~10:00',
      by_day: { '2': ['①코너 김치볶음밥&계란후라이', '②코너 주먹밥/베이컨샐러드'] },
    }
    render(<MealGridSection meal={meal} dayKey="2" />)

    expect(screen.getByText('①코너 김치볶음밥&계란후라이')).toBeInTheDocument()
    expect(screen.getByText('②코너 주먹밥/베이컨샐러드')).toBeInTheDocument()
    // 백엔드가 라벨을 메뉴에 묶어 보내므로, 태그 개수는 라벨을 뺀 실제 메뉴 수(2개)와 같다.
    expect(screen.getByTestId('menu-tags').children).toHaveLength(2)
  })

  // --- 복수메뉴 표시 ---
  it('메뉴 항목에 "/"로 구분된 선택지가 있으면 "· 복수메뉴"를 보여준다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['에비동/제육볶음면', '무채국'] } }
    render(<MealGridSection meal={meal} dayKey="2" />)
    expect(screen.getByText('· 복수메뉴')).toBeInTheDocument()
  })

  // --- 하단 부가정보(점선 구분) ---
  it('코너 표기가 있으면 좌측에 "코너 N곳 운영"을 보여준다', () => {
    const meal = {
      type: '조식',
      time: '8:30~10:00',
      by_day: { '2': ['①코너 김치볶음밥&계란후라이', '②코너 주먹밥/베이컨샐러드'] },
    }
    render(<MealGridSection meal={meal} dayKey="2" isNowOpen={false} showLiveStatus />)
    expect(screen.getByText('코너 2곳 운영')).toBeInTheDocument()
    // 지금 운영 중이 아니므로 우측은 "내일 8:30 재개"
    expect(screen.getByText('내일 8:30 재개')).toBeInTheDocument()
  })

  it('지금 운영 중이면 우측에 "HH:MM 종료"를 보여준다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['비빔밥', '된장찌개'] } }
    render(<MealGridSection meal={meal} dayKey="2" isNowOpen showLiveStatus />)
    expect(screen.getByText('14:00 종료')).toBeInTheDocument()
    // 코너 표기가 없으므로 좌측은 메뉴 가짓수
    expect(screen.getByText('메뉴 2가지')).toBeInTheDocument()
  })

  it('showLiveStatus가 false면 하단 부가정보를 렌더하지 않는다', () => {
    const meal = { type: '중식', time: '11:00~14:00', by_day: { '2': ['비빔밥'] } }
    render(<MealGridSection meal={meal} dayKey="2" showLiveStatus={false} />)
    expect(screen.queryByText(/종료|재개/)).not.toBeInTheDocument()
  })

  // --- 빈 메뉴 ---
  it('빈 메뉴("미운영")면 태그 대신 안내 문구를 보여준다', () => {
    const meal = { type: '석식', time: '17:00~19:00', by_day: { '2': ['미운영'] } }
    render(<MealGridSection meal={meal} dayKey="2" showLiveStatus />)
    expect(screen.getByText(/운영하지 않아요/)).toBeInTheDocument()
    expect(screen.queryByTestId('menu-tags')).not.toBeInTheDocument()
  })

  // --- compact(다른 식당 미리보기) ---
  it('compact면 태그를 최대 3개까지만 보여주고 상태 pill/부가정보를 생략한다', () => {
    const meal = {
      type: '중식',
      time: '11:30~13:50',
      by_day: { '2': ['부대찌개', '잡곡밥', '치즈계란말이', '마파두부', '깍두기'] },
    }
    render(<MealGridSection meal={meal} dayKey="2" compact isNowOpen showLiveStatus />)

    expect(screen.getByText('부대찌개')).toBeInTheDocument()
    expect(screen.getByText('치즈계란말이')).toBeInTheDocument()
    expect(screen.queryByText('마파두부')).not.toBeInTheDocument()
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.queryByText('지금 운영중')).not.toBeInTheDocument()
    expect(screen.queryByText('영업 중')).not.toBeInTheDocument()
  })
})
