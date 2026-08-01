import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import SegmentedControl from './SegmentedControl'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = fs.readFileSync(path.join(__dirname, 'SegmentedControl.jsx'), 'utf8')

const OPTIONS = [
  { value: 'commute', label: '등교' },
  { value: 'return', label: '하교' },
]

describe('SegmentedControl', () => {
  it('role=tablist 컨테이너를 렌더한다', () => {
    render(<SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} ariaLabel="방향" />)
    expect(screen.getByRole('tablist', { name: '방향' })).toBeInTheDocument()
  })

  it('각 옵션이 role=tab으로 렌더된다', () => {
    render(<SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '등교' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '하교' })).toBeInTheDocument()
  })

  it('활성 옵션에 aria-selected=true, 나머지는 false', () => {
    render(<SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: '등교' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '하교' })).toHaveAttribute('aria-selected', 'false')
  })

  it('탭 클릭 시 onChange(value) 호출', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="commute" onChange={onChange} />)
    screen.getByRole('tab', { name: '하교' }).click()
    expect(onChange).toHaveBeenCalledWith('return')
  })

  it('size="sm"이면 컨테이너가 inline-flex(콘텐츠 폭만 차지)', () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} size="sm" />
    )
    expect(container.firstChild.className).toMatch(/inline-flex/)
  })

  it('선택 배경은 --tj-pill-active-bg 토큰만 참조(teal 하드코딩 없음)', () => {
    expect(SRC).toMatch(/var\(--tj-pill-active-bg\)/)
    expect(SRC).not.toMatch(/bg-accent\b/)
    expect(SRC).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('12px 미만(text-[8px]~text-[11px]) 폰트 클래스가 소스에 없다', () => {
    const matches = SRC.match(/text-\[(8|9|10|11)px\]/g)
    expect(matches, `${matches} 남아있음 (12px 미만)`).toBeNull()
  })
})
