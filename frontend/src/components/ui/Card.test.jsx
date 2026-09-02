import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Card from './Card'

describe('Card', () => {
  it('imminent 상태에 좌측 바(border-l/border-left) 클래스를 쓰지 않는다', () => {
    const { container } = render(<Card state="imminent">x</Card>)
    expect(container.firstChild.className).not.toMatch(/border-l-|border-left|border-l\b/)
  })

  it('interactive + as=button 이면 button 역할', () => {
    render(<Card interactive as="button">탭</Card>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('children을 렌더한다', () => {
    render(<Card>내용</Card>)
    expect(screen.getByText('내용')).toBeInTheDocument()
  })

  it('기본 상태에 bg-surface 와 border-line 클래스가 있다', () => {
    const { container } = render(<Card>기본</Card>)
    expect(container.firstChild.className).toMatch(/bg-surface/)
    expect(container.firstChild.className).toMatch(/border-line/)
  })

  it('selected 상태에 border-accent 와 bg-accent-bg 클래스가 있다', () => {
    const { container } = render(<Card state="selected">선택됨</Card>)
    expect(container.firstChild.className).toMatch(/border-accent/)
    expect(container.firstChild.className).toMatch(/bg-accent-bg/)
  })

  it('imminent 상태에 border-imminent 클래스가 있다', () => {
    const { container } = render(<Card state="imminent">임박</Card>)
    expect(container.firstChild.className).toMatch(/border-imminent/)
  })

  it('muted 상태에 text-mute 클래스가 있다', () => {
    const { container } = render(<Card state="muted">조용</Card>)
    expect(container.firstChild.className).toMatch(/text-mute/)
  })

  it('interactive 이면 active:scale 류 클래스가 있다', () => {
    const { container } = render(<Card interactive>인터랙티브</Card>)
    expect(container.firstChild.className).toMatch(/active:scale/)
  })

  it('기본 엘리먼트는 div다', () => {
    const { container } = render(<Card>기본태그</Card>)
    expect(container.firstChild.tagName).toBe('DIV')
  })

  it('as=button 이면 button 엘리먼트다', () => {
    const { container } = render(<Card as="button">버튼태그</Card>)
    expect(container.firstChild.tagName).toBe('BUTTON')
  })

  it('기본 상태는 shadow-sh-card 를 쓰고(라이트), 다크에선 보더로 대체한다(그림자+보더 동시 사용 금지)', () => {
    const { container } = render(<Card>기본</Card>)
    const cls = container.firstChild.className
    expect(cls).toMatch(/shadow-sh-card/)
    expect(cls).toMatch(/dark:border/)
    expect(cls).toMatch(/dark:shadow-none/)
  })

  it('기본 패딩은 18px(p-[18px])이다', () => {
    const { container } = render(<Card>패딩</Card>)
    expect(container.firstChild.className).toMatch(/p-\[18px\]/)
  })

  it('compact 이면 패딩이 16px(p-4)로 바뀐다', () => {
    const { container } = render(<Card compact>컴팩트</Card>)
    const cls = container.firstChild.className
    expect(cls).toMatch(/\bp-4\b/)
    expect(cls).not.toMatch(/p-\[18px\]/)
  })

  it('padding="none" 이면 패딩 유틸이 없다(다분할 카드가 자체 패딩을 관리)', () => {
    const { container } = render(<Card padding="none">없음</Card>)
    const cls = container.firstChild.className
    expect(cls).not.toMatch(/p-\[18px\]/)
    expect(cls).not.toMatch(/\bp-4\b/)
  })

  it('onClick은 interactive 여부와 무관하게 항상 연결된다(chevron만 interactive에 종속)', () => {
    const onClick = vi.fn()
    const { container } = render(<Card onClick={onClick}>클릭</Card>)
    container.firstChild.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
