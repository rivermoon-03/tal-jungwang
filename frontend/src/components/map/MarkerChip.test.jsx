/**
 * MarkerChip — 다크 대응 + ETA 색 통일 + 글자 키움 테스트
 */

import { describe, it, expect } from 'vitest'
import { createMarkerChipElement, createSeohaeSiheungChipElement, createSubwayMultiChipElement } from './MarkerChip'

// DOM 생성 함수가 반환하는 outerHTML 전체를 평문 검사하는 헬퍼
function outerHTML(el) {
  return el.outerHTML
}

describe('createMarkerChipElement — 다크 대응', () => {
  it('pill 배경이 var(--tj-surface) 이어야 한다 (하드코딩 #fff 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    // 배경: var(--tj-surface) 포함
    expect(html).toContain('var(--tj-surface)')
    // 하드코딩 흰색 배경 없음
    expect(html).not.toMatch(/background:#fff/i)
    expect(html).not.toMatch(/background: #fff/i)
    expect(html).not.toMatch(/background:#ffffff/i)
  })

  it('정류장 텍스트 색이 var(--tj-ink) 이어야 한다 (하드코딩 #1b3a6e 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-ink)')
    // 하드코딩 네이비 없음
    expect(html).not.toContain('#1b3a6e')
  })

  it('글자 크기가 12px 이상이어야 한다 (9px / 11px 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).not.toMatch(/font-size:9px/i)
    expect(html).not.toMatch(/font-size:10px/i)
    expect(html).not.toMatch(/font-size:11px/i)
  })

  it('liveMinutes ≤ 3 이면 ETA 텍스트에 var(--tj-imminent) 색이 적용된다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 2,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
  })

  it('liveMinutes > 3 이면 ETA 텍스트는 var(--tj-ink) 또는 일반 색이어야 한다 (imminent 없음)', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 10,
      showLive: true,
    })
    const html = outerHTML(el)
    // imminent 색 없음
    expect(html).not.toContain('var(--tj-imminent)')
  })

  it('extraPillText도 하드코딩 흰색 배경을 쓰지 않는다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      extraPillText: '막차 임박',
    })
    const html = outerHTML(el)
    expect(html).not.toMatch(/background:#fff(?:[^a-z]|$)/i)
  })
})

describe('createSeohaeSiheungChipElement — 다크 대응', () => {
  it('pill 배경이 var(--tj-surface)이어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-surface)')
    expect(html).not.toMatch(/background:#fff(?:[^a-z0-9]|$)/i)
  })

  it('제목 텍스트가 var(--tj-ink)이어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-ink)')
    expect(html).not.toContain('#1b3a6e')
  })

  it('글자 크기가 12px 이상이어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).not.toMatch(/font-size:9px/i)
    expect(html).not.toMatch(/font-size:10px/i)
    expect(html).not.toMatch(/font-size:11px/i)
  })
})

describe('createSubwayMultiChipElement — 다크 대응', () => {
  it('pill 배경이 var(--tj-surface)이어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-surface)')
    expect(html).not.toMatch(/background:#fff(?:[^a-z0-9]|$)/i)
  })

  it('셀 텍스트가 var(--tj-ink)이어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-ink)')
    expect(html).not.toContain('#1b3a6e')
  })

  it('글자 크기가 12px 이상이어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).not.toMatch(/font-size:9px/i)
    expect(html).not.toMatch(/font-size:10px/i)
    expect(html).not.toMatch(/font-size:11px/i)
  })

  it('subwayData가 있을 때 분 값이 렌더된다', () => {
    const el = createSubwayMultiChipElement({
      subwayData: {
        up: { arrive_in_seconds: 180 },
        down: { arrive_in_seconds: 300 },
        line4_up: null,
        line4_down: { arrive_in_seconds: 60 },
      },
    })
    const html = outerHTML(el)
    expect(html).toContain('3분')
    expect(html).toContain('5분')
  })
})
