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

  it('숫자 ETA는 text-eta-num 토큰(22px/800/tabular)을 쓴다', () => {
    render(<TransitCard {...BASE_PROPS} />)
    expect(screen.getByText('3분').className).toMatch(/text-eta-num/)
  })

  it('ETA 열 컨테이너에 min-w-0이 없다 — 넘친 텍스트가 본문 위로 그려지던 원인(D2)', () => {
    const { container } = render(<TransitCard {...BASE_PROPS} />)
    const etaCol = container.querySelector('.min-h-\\[44px\\]')
    expect(etaCol).not.toBeNull()
    expect(etaCol.className).not.toMatch(/min-w-0/)
  })
})

// ── 시안2 "다정한 카드" 회귀 — 노선 타일(56px)·칩 상한 ──
describe('TransitCard — 노선 타일 규격', () => {
  it('타일이 56px(w-14/h-14) 정사각형이다', () => {
    render(<TransitCard {...BASE_PROPS} />)
    const tile = screen.getByText('20-1')
    expect(tile.className).toMatch(/w-14/)
    expect(tile.className).toMatch(/h-14/)
  })

  it('badge.mode가 있으면 노선 종류 글리프를 그린다', () => {
    const props = { ...BASE_PROPS, badge: { label: '20-1', mode: 'bus' } }
    const { container } = render(<TransitCard {...props} />)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('badge.mode가 없으면 글리프 없이 번호만 그린다', () => {
    const { container } = render(<TransitCard {...BASE_PROPS} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  // ShuttlePanel처럼 노선 번호가 없는 호출부를 위한 회귀 — label을 생략하면
  // 글리프만 그리고 라벨 텍스트 노드는 전혀 렌더하지 않는다.
  it('badge.label이 없으면 글리프만 그리고 라벨 텍스트는 렌더하지 않는다', () => {
    const props = { ...BASE_PROPS, badge: { bgVar: '#7c3aed', mode: 'shuttle' } }
    const { container } = render(<TransitCard {...props} />)
    const glyph = container.querySelector('svg')
    expect(glyph).not.toBeNull()
    expect(glyph.parentElement.textContent).toBe('')
  })
})

describe('TransitCard — 칩 상한(2개 + "+N")', () => {
  const manyChips = [
    { label: '실시간', tone: 'realtime' },
    { label: '잔여좌석', tone: 'good' },
    { label: '3정거장 전', tone: 'neutral' },
    { label: '베타', tone: 'beta' },
    { label: '제보', tone: 'warn' },
    { label: '경로 사고', tone: 'warn' },
    { label: '경유', tone: 'neutral' },
  ]

  it('칩이 2개 이하면 전부 보여준다(접지 않는다)', () => {
    render(<TransitCard {...BASE_PROPS} />)
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('혼잡')).toBeInTheDocument()
    expect(screen.queryByText(/^\+\d/)).not.toBeInTheDocument()
  })

  it('칩이 2개를 넘으면 앞 2개만 보여주고 나머지는 "+N" 하나로 접는다', () => {
    render(<TransitCard {...BASE_PROPS} chips={manyChips} />)
    expect(screen.getByText('실시간')).toBeInTheDocument()
    expect(screen.getByText('잔여좌석')).toBeInTheDocument()
    expect(screen.queryByText('3정거장 전')).not.toBeInTheDocument()
    expect(screen.queryByText('베타')).not.toBeInTheDocument()
    // 7개 중 앞 2개를 뺀 나머지 5개가 접힌다
    expect(screen.getByText('+5')).toBeInTheDocument()
  })
})
