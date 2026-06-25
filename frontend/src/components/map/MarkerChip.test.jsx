/**
 * MarkerChip — 다크 대응 + ETA 색 통일 + 글자 키움 + 시안2 카드분리형 구조 테스트
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

// ============================================================
// 시안2 카드 분리형 구조 테스트
// ============================================================

describe('시안2 — createMarkerChipElement 카드 분리형 구조', () => {
  it('lead 블록이 노선색 배경으로 존재해야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    // lead 블록: data-role="lead" 속성 포함
    expect(html).toContain('data-role="lead"')
  })

  it('body 블록이 정류장명(.name)과 big 영역을 포함해야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('data-role="body"')
    expect(html).toContain('data-role="name"')
    expect(html).toContain('정왕역')
  })

  it('showLive=true이면 big 영역에 실시간 시각이 렌더된다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '시흥시청',
      liveMinutes: 11,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('data-role="big"')
    expect(html).toContain('11')
  })

  it('showLive=false이면 big 영역에 실시간이 없어야 한다(정류장명만)', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      showLive: false,
    })
    const html = outerHTML(el)
    // big 영역은 있되 분 단위 숫자 없음 (정적 시간표 텍스트는 subLabel로 별도 처리)
    expect(html).toContain('data-role="body"')
  })

  it('liveMinutes <= 3이면 big 영역이 imminent 색을 가진다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 2,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
  })

  it('칩 본체 border-radius가 13px이어야 한다 (시안2 카드형)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    // JSDOM은 인라인 style을 "border-radius: 13px"(공백 포함)로 직렬화
    expect(html).toMatch(/border-radius:\s*13px/)
  })

  it('꼬리(tail) 삼각형 요소가 있어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('data-role="tail"')
  })

  it('name 영역 글자가 13px 이상이어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).not.toMatch(/font-size:9px/i)
    expect(html).not.toMatch(/font-size:10px/i)
    expect(html).not.toMatch(/font-size:11px/i)
    expect(html).not.toMatch(/font-size:12px/i)
  })

  it('big 영역 글자가 15px이어야 한다 (실시간 시각 강조)', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 8,
      showLive: true,
    })
    const html = outerHTML(el)
    // JSDOM: "font-size: 15px" 형태
    expect(html).toMatch(/font-size:\s*15px/)
  })
})

describe('시안2 — createSubwayMultiChipElement 카드 분리형 구조', () => {
  it('lead 블록이 존재해야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="lead"')
  })

  it('body 블록이 존재해야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="body"')
  })

  it('칩 본체 border-radius가 13px이어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toMatch(/border-radius:\s*13px/)
  })

  it('꼬리(tail) 요소가 있어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="tail"')
  })

  it('big 영역이 15px 글자로 렌더된다', () => {
    const el = createSubwayMultiChipElement({
      subwayData: { up: { arrive_in_seconds: 180 }, down: null, line4_up: null, line4_down: null },
    })
    const html = outerHTML(el)
    expect(html).toMatch(/font-size:\s*15px/)
  })
})

describe('시안2 — createSeohaeSiheungChipElement 카드 분리형 구조', () => {
  it('lead 블록이 서해선 색으로 존재해야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="lead"')
    // 서해선 색 포함 (JSDOM은 rgb()로 변환하므로 원본 style 속성 직접 확인)
    const lead = el.querySelector('[data-role="lead"]')
    expect(lead.style.background).toMatch(/75bf43|rgb\(117,\s*191,\s*67\)/)
  })

  it('body 블록에 정류장명이 표시된다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="body"')
    expect(html).toContain('시흥시청역')
  })

  it('칩 본체 border-radius가 13px이어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toMatch(/border-radius:\s*13px/)
  })

  it('꼬리(tail) 요소가 있어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="tail"')
  })

  it('big 영역이 15px 글자로 렌더된다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toMatch(/font-size:\s*15px/)
  })

  it('upMinutes <= 3이면 imminent 색이 적용된다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 2, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
  })
})
