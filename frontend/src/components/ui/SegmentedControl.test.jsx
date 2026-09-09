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

  it('md·sm 모두 최소 터치 영역 44px를 지킨다', () => {
    for (const size of ['md', 'sm']) {
      const { unmount } = render(
        <SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} size={size} />
      )
      expect(screen.getByRole('tab', { name: '등교' }).className).toMatch(/min-h-\[44px\]/)
      unmount()
    }
  })

  it('sm은 높이가 아니라 폭 거동만 바꾼다 — 36px·38px 같은 축소 높이가 없다', () => {
    expect(SRC).not.toMatch(/min-h-\[(2\d|3\d|4[0-3])px\]/)
  })

  it('disabled 항목은 onChange 대신 onDisabledClick을 부른다', () => {
    const onChange = vi.fn()
    const onDisabledClick = vi.fn()
    render(
      <SegmentedControl
        options={[{ value: 'a', label: '가' }, { value: 'b', label: '나', disabled: true }]}
        value="a"
        onChange={onChange}
        onDisabledClick={onDisabledClick}
      />
    )
    const disabled = screen.getByRole('tab', { name: '나' })
    expect(disabled).toHaveAttribute('aria-disabled', 'true')
    disabled.click()
    expect(onChange).not.toHaveBeenCalled()
    expect(onDisabledClick).toHaveBeenCalledWith('b')
  })

  it('다크에서 트랙 배경을 bg-bg로 맞추고 border-line으로 층을 구분한다', () => {
    render(<SegmentedControl options={OPTIONS} value="commute" onChange={() => {}} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('bg-surface-2')
    expect(tablist.className).toContain('dark:bg-bg')
    expect(tablist.className).toContain('dark:border-line')
  })

  it('src 안에 세그먼트 컨트롤 구현체가 이 파일 하나뿐이다', () => {
    const SRC_ROOT = path.resolve(__dirname, '..', '..')
    const offenders = []
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) { walk(full); continue }
        if (!entry.name.endsWith('.jsx') || entry.name.includes('.test.')) continue
        if (full === path.join(__dirname, 'SegmentedControl.jsx')) continue
        const body = fs.readFileSync(full, 'utf8')
        // role="tablist" 를 직접 그리면서 슬라이딩 인디케이터까지 가진 파일은
        // 정본을 우회한 두 번째 구현이다. (요일 그리드처럼 인디케이터가 없는
        // tablist 는 세그먼트 컨트롤이 아니라 통과시킨다.)
        if (body.includes('role="tablist"') && body.includes('translateX(')) {
          offenders.push(path.relative(SRC_ROOT, full))
        }
      }
    }
    walk(SRC_ROOT)
    expect(offenders, `${offenders.join(', ')} 가 별도 세그먼트 컨트롤을 구현함`).toEqual([])
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
