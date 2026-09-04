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

  // 다크에서 트랙(bg-surface-2)과 페이지 배경(bg-bg) 사이 색차가 라이트보다 커서
  // 옅은 경계로 보였다(실측: 라이트 4/255, 다크 16/255 — --tj-surface-2가 라이트는
  // bg 바로 위 한 단이지만 다크는 두 단이라 벌어짐). 다크는 채움을 dark:bg-bg로
  // 페이지 배경과 맞추고 dark:border dark:border-line으로 층을 구분한다.
  it('다크에서 트랙 배경을 bg-bg로 맞추고 border-line으로 층을 구분한다', () => {
    render(<SegmentTabs items={[{id:'bus',label:'버스'}]} active="bus" onChange={()=>{}} />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.className).toContain('bg-surface-2')
    expect(tablist.className).toContain('dark:bg-bg')
    expect(tablist.className).toContain('dark:border')
    expect(tablist.className).toContain('dark:border-line')
  })
})
