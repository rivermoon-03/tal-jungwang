import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import TransitCard from './TransitCard'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = fs.readFileSync(path.join(__dirname, 'TransitCard.jsx'), 'utf8')

const BASE_PROPS = {
  badge: { label: '20-1' },
  title: '시흥시청행',
  subtitle: '상행',
  chips: [
    { label: '실시간', tone: 'realtime' },
    { label: '혼잡', tone: 'warn' },
  ],
  eta: {
    primary: { text: '3분', tone: 'imminent' },
    secondary: { text: '다음 12분' },
  },
}

describe('TransitCard', () => {
  it('배지/제목/부제/칩/ETA를 렌더한다', () => {
    render(<TransitCard {...BASE_PROPS} />)
    expect(screen.getByText('20-1')).toBeInTheDocument()
    expect(screen.getByText('시흥시청행')).toBeInTheDocument()
    expect(screen.getByText('상행')).toBeInTheDocument()
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('혼잡')).toBeInTheDocument()
    expect(screen.getByText('3분')).toBeInTheDocument()
    expect(screen.getByText('다음 12분')).toBeInTheDocument()
  })

  it('onClick이 없으면 div로 렌더된다', () => {
    const { container } = render(<TransitCard {...BASE_PROPS} />)
    expect(container.firstChild.tagName).toBe('DIV')
  })

  it('onClick이 있으면 button 역할이고 클릭 시 호출된다', () => {
    const onClick = vi.fn()
    render(<TransitCard {...BASE_PROPS} onClick={onClick} />)
    const btn = screen.getByRole('button')
    btn.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('muted=true면 제목에 text-mute 클래스가 붙는다', () => {
    render(<TransitCard {...BASE_PROPS} muted />)
    expect(screen.getByText('시흥시청행').className).toMatch(/text-mute/)
  })

  it('title에 line-clamp-2를 쓰고 truncate/ellipsis 단일행 클래스는 쓰지 않는다', () => {
    render(<TransitCard {...BASE_PROPS} />)
    const titleClass = screen.getByText('시흥시청행').className
    expect(titleClass).toMatch(/line-clamp-2/)
    expect(titleClass).not.toMatch(/\btruncate\b/)
  })

  it('eta.primary가 tone=imminent이면 text-imminent 클래스만 적용(보더/배경 없음)', () => {
    render(<TransitCard {...BASE_PROPS} />)
    const primaryEl = screen.getByText('3분')
    expect(primaryEl.className).toMatch(/text-imminent/)
    expect(primaryEl.className).not.toMatch(/border-imminent|bg-imminent/)
  })

  it('secondary가 없어도 ETA 열이 2줄 높이를 예약한다(min-h-[44px])', () => {
    const props = { ...BASE_PROPS, eta: { primary: { text: '5분', tone: 'default' } } }
    const { container } = render(<TransitCard {...props} />)
    const etaCol = container.querySelector('.min-h-\\[44px\\]')
    expect(etaCol).not.toBeNull()
  })

  it('badge.bgVar를 넘기면 인라인 배경색이 적용된다', () => {
    render(<TransitCard {...BASE_PROPS} badge={{ label: '3400', bgVar: '#dc2626' }} />)
    const badgeEl = screen.getByText('3400')
    expect(badgeEl.style.backgroundColor).toBeTruthy()
  })

  it('grid-cols-[auto_1fr_auto] 해부도를 쓴다', () => {
    const { container } = render(<TransitCard {...BASE_PROPS} />)
    expect(container.firstChild.className).toMatch(/grid-cols-\[auto_1fr_auto\]/)
  })

  it('12px 미만(text-[8px]~text-[11px]) 폰트 클래스가 소스에 없다', () => {
    const matches = SRC.match(/text-\[(8|9|10|11)px\]/g)
    expect(matches, `${matches} 남아있음 (12px 미만)`).toBeNull()
  })
})

// ── D2/D3 회귀 — 실사례: 모바일 홈 11-A 카드에서 "현재 도착 정보 없음"(22px)이
// subtitle "한국공학대학교 승차" 위로 겹쳐 그려졌고, PC 패널에서 "20-1" 배지가
// "20-"/"1" 두 줄로 꺾였다. 레이아웃은 jsdom으로 못 재므로 원인 클래스를 고정한다.
describe('TransitCard — 겹침(D2)·배지 줄바꿈(D3) 회귀', () => {
  it('배지에 whitespace-nowrap이 있다 — 하이픈 노선번호 줄바꿈 방지(D3)', () => {
    render(<TransitCard {...BASE_PROPS} />)
    expect(screen.getByText('20-1').className).toMatch(/whitespace-nowrap/)
  })

  it('subtitle은 shrink-0이 아니라 truncate로 줄어든다(D2)', () => {
    render(<TransitCard {...BASE_PROPS} subtitle="한국공학대학교 승차" />)
    const subtitle = screen.getByText('한국공학대학교 승차')
    expect(subtitle.className).toMatch(/truncate/)
    expect(subtitle.className).not.toMatch(/shrink-0/)
  })

  it('muted 상태 문장은 22px 숫자 스타일이 아니라 줄바꿈 허용 스타일이다(D2)', () => {
    render(
      <TransitCard
        {...BASE_PROPS}
        eta={{ primary: { text: '현재 도착 정보 없음', tone: 'muted' }, secondary: { text: '잠시 후 다시 확인' } }}
      />
    )
    const primary = screen.getByText('현재 도착 정보 없음')
    expect(primary.className).toMatch(/break-keep/)
    expect(primary.className).not.toMatch(/text-\[22px\]/)
  })

  it('숫자 ETA는 22px 스타일을 유지한다', () => {
    render(<TransitCard {...BASE_PROPS} />)
    expect(screen.getByText('3분').className).toMatch(/text-\[22px\]/)
  })

  it('ETA 열 컨테이너에 min-w-0이 없다 — 넘친 텍스트가 본문 위로 그려지던 원인(D2)', () => {
    const { container } = render(<TransitCard {...BASE_PROPS} />)
    const etaCol = container.querySelector('.min-h-\\[44px\\]')
    expect(etaCol).not.toBeNull()
    expect(etaCol.className).not.toMatch(/min-w-0/)
  })
})
