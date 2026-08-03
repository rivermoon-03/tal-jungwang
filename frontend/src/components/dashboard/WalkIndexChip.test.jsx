/**
 * WalkIndexChip — 이동 지수 팝오버의 동적 factors 렌더·낙뢰 행·출처 줄 테스트.
 *
 * 초단기예보 전환으로 factors가 3행 고정이 아니게 됐다(낙뢰 감지 시 4행).
 * 렌더가 배열 길이를 따라가는지, 낙뢰 행이 imminent 톤인지, 팝오버 하단
 * 출처 줄(sourceLabel)이 있을 때만 붙는지 검증한다. 파일 하단에는 이 파일이
 * 지켜야 할 토큰 규율(12px 미만 금지 등)을 소스 정규식으로 박아둔다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WalkIndexChip from './WalkIndexChip'

const BASE_FACTORS = [
  { key: 'temp', label: '기온', value: '29°', decisive: false },
  { key: 'rain', label: '강수확률', value: '10%', decisive: false },
  { key: 'dust', label: '미세먼지', value: '좋음', decisive: false },
]

function makeIndex(overrides = {}) {
  return {
    level: 'good',
    label: '걷기 좋음',
    reason: '지금 날씨가 걷기에 좋아요',
    factors: BASE_FACTORS,
    sourceLabel: '14:30 발표 초단기예보 기준',
    ...overrides,
  }
}

function openPopover() {
  fireEvent.click(screen.getByRole('button', { name: /이동 지수/ }))
}

describe('WalkIndexChip — 동적 factors 렌더', () => {
  it('walkIndex가 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<WalkIndexChip walkIndex={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('칩을 탭하면 팝오버에 근거와 3행이 펼쳐진다', () => {
    render(<WalkIndexChip walkIndex={makeIndex()} />)
    openPopover()

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('지금 날씨가 걷기에 좋아요')).toBeInTheDocument()
    for (const f of BASE_FACTORS) {
      expect(screen.getByText(f.label)).toBeInTheDocument()
      expect(screen.getByText(f.value)).toBeInTheDocument()
    }
  })

  it('낙뢰 행이 오면 4행째로 렌더된다 — 3행 하드코딩이 아니다', () => {
    const idx = makeIndex({
      level: 'indoor',
      label: '실내 권장',
      reason: '낙뢰 예보',
      factors: [
        ...BASE_FACTORS,
        { key: 'lightning', label: '낙뢰', value: '감지됨', decisive: true },
      ],
    })
    render(<WalkIndexChip walkIndex={idx} />)
    openPopover()

    expect(screen.getByText('낙뢰')).toBeInTheDocument()
    expect(screen.getByText('감지됨')).toBeInTheDocument()
  })

  it('decisive 행에는 기준 배지와 imminent 값 톤이 붙는다', () => {
    const idx = makeIndex({
      level: 'transit',
      label: '대중교통 권장',
      reason: '곧 비 예보',
      factors: [
        BASE_FACTORS[0],
        { key: 'rain', label: '강수확률', value: '10%', decisive: true },
        BASE_FACTORS[2],
      ],
    })
    render(<WalkIndexChip walkIndex={idx} />)
    openPopover()

    expect(screen.getByText('기준')).toBeInTheDocument()
    expect(screen.getByText('10%')).toHaveClass('text-imminent')
    // 비기준 행은 기본 톤 유지
    expect(screen.getByText('29°')).toHaveClass('text-ink-2')
  })

  it('낙뢰 행 값은 decisive가 아니어도 imminent 톤이다', () => {
    // 낙뢰가 감지됐지만 다른 항목이 기준일 수 있다 — 존재 자체가 경고이므로 톤 유지.
    const idx = makeIndex({
      factors: [
        ...BASE_FACTORS,
        { key: 'lightning', label: '낙뢰', value: '감지됨', decisive: false },
      ],
    })
    render(<WalkIndexChip walkIndex={idx} />)
    openPopover()

    expect(screen.getByText('감지됨')).toHaveClass('text-imminent')
  })
})

describe('WalkIndexChip — 출처 줄', () => {
  it('sourceLabel이 있으면 팝오버 하단에 mute 톤 출처 줄이 붙는다', () => {
    render(<WalkIndexChip walkIndex={makeIndex()} />)
    openPopover()

    const source = screen.getByText('14:30 발표 초단기예보 기준')
    expect(source).toHaveClass('text-micro', 'text-mute', 'border-t')
  })

  it('폴백이면 단기예보 출처가 그대로 보인다', () => {
    render(<WalkIndexChip walkIndex={makeIndex({ sourceLabel: '11:00 발표 단기예보 기준' })} />)
    openPopover()

    expect(screen.getByText('11:00 발표 단기예보 기준')).toBeInTheDocument()
  })

  it('sourceLabel이 없으면(구버전 응답) 출처 줄 자체가 없다', () => {
    render(<WalkIndexChip walkIndex={makeIndex({ sourceLabel: null })} />)
    openPopover()

    expect(screen.queryByText(/발표.*기준/)).not.toBeInTheDocument()
  })
})

// ── 토큰 규율 — DESIGN.md 네거티브 룰을 소스 정규식으로 강제 ──────────────
// dashboard 디렉터리에는 공용 토큰 테스트가 없어 이 파일이 그 역할을 겸한다.
describe('WalkIndexChip — 토큰 규율', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const src = fs.readFileSync(path.join(__dirname, 'WalkIndexChip.jsx'), 'utf8')

  it('12px 미만 임의 폰트(text-[8px]~text-[11px])가 없다', () => {
    expect(src).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })

  it('primitive hex 인라인이 없다 — semantic 토큰만 쓴다', () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('생색 유틸(text-slate-*/text-gray-*)이 없다', () => {
    expect(src).not.toMatch(/text-(?:slate|gray)-/)
  })
})
