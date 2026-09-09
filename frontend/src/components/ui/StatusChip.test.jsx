import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusChip from './StatusChip'
import { STATUS_CHIP_KINDS } from './statusChipKinds'

describe('StatusChip', () => {
  it('이모지를 렌더하지 않는다', () => {
    const { container } = render(<StatusChip kind="last">막차</StatusChip>)
    expect(container.textContent).toBe('막차')
    expect(/\p{Extended_Pictographic}/u.test(container.textContent)).toBe(false)
  })
  it('children 텍스트 렌더', () => {
    const { getByText } = render(<StatusChip kind="realtime">실시간</StatusChip>)
    expect(getByText('실시간')).toBeTruthy()
  })
})

// 선언되지 않은 kind 는 폴백을 타고 조용히 다른 뜻의 칩으로 그려진다.
// 실제로 ScheduleSection 의 시간표 칩이 kind="neutral" 로 1년 가까이
// 막차 칩 스타일을 빌려 쓰고 있었다. 두 스타일 값이 우연히 같아서 화면에는
// 안 드러났고, 막차 칩 색을 바꾸는 순간 함께 바뀌었을 자리다.
describe('StatusChip kind 계약', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

  function walk(dir) {
    const out = []
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name)
      if (statSync(p).isDirectory()) out.push(...walk(p))
      else if (p.endsWith('.jsx') && !p.includes('.test.')) out.push(p)
    }
    return out
  }

  it('src 전역의 StatusChip kind= 는 전부 선언된 값이다', () => {
    const offenders = []
    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf-8')
      if (!src.includes('StatusChip')) continue
      for (const m of src.matchAll(/<StatusChip[^>]*?\skind="([^"]+)"/g)) {
        if (!STATUS_CHIP_KINDS.includes(m[1])) {
          offenders.push(`${file.replace(SRC, '')}: kind="${m[1]}"`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
