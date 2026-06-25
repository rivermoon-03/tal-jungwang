import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SegmentTabs from './SegmentTabs'

describe('SegmentTabs', () => {
  it('탭 클릭 시 onChange(id)', () => {
    const onChange = vi.fn()
    render(<SegmentTabs items={[{id:'bus',label:'버스'},{id:'subway',label:'지하철'}]} active="bus" onChange={onChange} />)
    screen.getByRole('tab', { name: '지하철' }).click()
    expect(onChange).toHaveBeenCalledWith('subway')
  })
  it('활성 탭 aria-selected=true', () => {
    render(<SegmentTabs items={[{id:'bus',label:'버스'}]} active="bus" onChange={()=>{}} />)
    expect(screen.getByRole('tab', { name: '버스' })).toHaveAttribute('aria-selected', 'true')
  })
})
