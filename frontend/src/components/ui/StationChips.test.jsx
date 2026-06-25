import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StationChips from './StationChips'

it('칩 클릭 시 onChange(id)', () => {
  const onChange = vi.fn()
  render(<StationChips items={[{id:'a',label:'본캠'},{id:'b',label:'이마트'}]} active="a" onChange={onChange} />)
  screen.getByText('이마트').click()
  expect(onChange).toHaveBeenCalledWith('b')
})
