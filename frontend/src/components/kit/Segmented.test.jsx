import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Segmented from './Segmented'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('Segmented', () => {
  const options = [
    { value: 'a', label: '버스' },
    { value: 'b', label: '지하철' },
    { value: 'c', label: '셔틀', disabled: true },
  ]

  it('선택 칸을 aria-selected 로 알리고 누르면 값을 넘긴다', () => {
    const onChange = vi.fn()
    render(<Segmented options={options} value="a" onChange={onChange} label="교통" />)
    expect(screen.getByRole('tab', { name: '버스' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: '지하철' }))
    expect(onChange).toHaveBeenCalledWith('b')
    expect(screen.getByRole('tab', { name: '셔틀' })).toBeDisabled()
  })

  it('src 안에 세그먼트 구현체가 이 파일 하나뿐이다', () => {
    const SRC = path.resolve(here, '..', '..')
    const offenders = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) { walk(full); continue }
        if (!e.name.endsWith('.jsx') || e.name.includes('.test.') || full === path.join(here, 'Segmented.jsx')) continue
        const body = fs.readFileSync(full, 'utf8')
        // role="tablist" 를 그리면서 미끄러지는 선택 면까지 가진 파일은 두 번째 구현이다.
        if (body.includes('role="tablist"') && body.includes('translateX(')) offenders.push(path.relative(SRC, full))
      }
    }
    walk(SRC)
    expect(offenders).toEqual([])
  })
})
