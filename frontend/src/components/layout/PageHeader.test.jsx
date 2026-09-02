/**
 * PageHeader 테스트
 *
 * 시안2 시각 언어 통일 작업 — 예전엔 style={{ fontSize: 24, fontWeight: 700 }}을
 * 인라인으로 박아 다른 6개 페이지가 직접 쓰는 text-page-ttl(26px/900)과 크기가
 * 어긋났고, 접근성 글자 크기 슬라이더(--tj-font-scale)도 먹지 않았다. 토큰
 * 클래스로 통일했는지, 인라인 fontSize가 남아있지 않은지 검증한다.
 */
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PageHeader from './PageHeader'

describe('PageHeader', () => {
  it('제목에 text-page-ttl 토큰 클래스를 사용한다', () => {
    render(<PageHeader title="더보기" />)
    const heading = screen.getByRole('heading', { level: 1, name: '더보기' })
    expect(heading.className).toContain('text-page-ttl')
  })

  it('인라인 fontSize를 더 이상 쓰지 않는다(글자 크기 설정 --tj-font-scale이 먹혀야 함)', () => {
    render(<PageHeader title="더보기" />)
    const heading = screen.getByRole('heading', { level: 1, name: '더보기' })
    expect(heading.style.fontSize).toBe('')
    expect(heading.style.fontWeight).toBe('')
  })

  it('subtitle이 있으면 함께 렌더한다', () => {
    render(<PageHeader title="더보기" subtitle="설정과 안내" />)
    expect(screen.getByText('설정과 안내')).toBeInTheDocument()
  })

  it('action이 있으면 제목 옆에 렌더한다', () => {
    render(<PageHeader title="더보기" action={<button type="button">설정</button>} />)
    expect(screen.getByRole('button', { name: '설정' })).toBeInTheDocument()
  })
})
