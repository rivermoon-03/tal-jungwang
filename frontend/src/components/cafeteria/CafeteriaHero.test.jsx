/**
 * CafeteriaHero — 결함 #16 회귀 테스트.
 *
 * 예전엔 루트 컨테이너가 min-h-[290px] + justify-center였다. 콘텐츠 높이가
 * 290px보다 낮은 경우가 대부분이라, 그 차이만큼이 위아래 빈 여백으로 나뉘어
 * 붙었다(식당 칩과 제목 사이, 요일 칩 캡션과 첫 끼니 카드 사이). jsdom은 실제
 * 레이아웃 높이를 계산하지 않으므로, 여백을 만들던 고정 높이/센터링 클래스가
 * 다시 붙지 않는지 구조로 고정한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import CafeteriaHero from './CafeteriaHero'

const DAY_CHIP_ITEMS = [
  { id: '1', label: '1일', hasMenu: true, isToday: false },
  { id: '2', label: '2일', hasMenu: true, isToday: true },
]

describe('CafeteriaHero', () => {
  it('결함 #16: 고정 최소높이나 세로 중앙 정렬 클래스를 쓰지 않는다', () => {
    const { container } = render(
      <CafeteriaHero
        cafeteriaName="TIP 학생식당"
        dayChipItems={DAY_CHIP_ITEMS}
        effectiveDay="2"
        onSelectDay={vi.fn()}
      />
    )
    const root = container.firstChild
    expect(root.className).not.toContain('min-h-')
    expect(root.className).not.toContain('justify-center')
  })

  it('제목과 요일 칩 캡션을 렌더한다', () => {
    render(
      <CafeteriaHero
        cafeteriaName="TIP 학생식당"
        dayChipItems={DAY_CHIP_ITEMS}
        effectiveDay="2"
        onSelectDay={vi.fn()}
      />
    )
    expect(screen.getByText('오늘 뭐 먹지')).toBeInTheDocument()
    expect(screen.getByText('점은 오늘 · 채움은 선택')).toBeInTheDocument()
  })
})
