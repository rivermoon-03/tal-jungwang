/**
 * MarkerChip — 시안1 정보 밀도형 구조 테스트
 *
 * 칩 구조: pill(border-radius:999px) + dot(22x22 원형 배지) + name + live/sub
 * 크기 기준: 패딩 5px 11px 5px 5px, font-size >= 13px
 */

import { describe, it, expect } from 'vitest'
import { createMarkerChipElement, createSeohaeSiheungChipElement, createSubwayMultiChipElement } from './MarkerChip'

function outerHTML(el) {
  return el.outerHTML
}

// ============================================================
// 공통 다크 대응 & 접근성 (색 변수 사용, 하드코딩 흰색 없음)
// ============================================================

describe('createMarkerChipElement — 다크 대응', () => {
  it('pill 배경이 var(--tj-surface) 이어야 한다 (하드코딩 #fff 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-surface)')
    expect(html).not.toMatch(/background:#fff/i)
    expect(html).not.toMatch(/background: #fff/i)
    expect(html).not.toMatch(/background:#ffffff/i)
  })

  it('정류장 텍스트 색이 var(--tj-ink) 이어야 한다 (하드코딩 #1b3a6e 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-ink)')
    expect(html).not.toContain('#1b3a6e')
  })

  it('글자 크기가 12px 이상이어야 한다 (9px / 11px 없음)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).not.toMatch(/font-size:9px/i)
    expect(html).not.toMatch(/font-size:10px/i)
    expect(html).not.toMatch(/font-size:11px/i)
  })

  it('liveMinutes <= 3 이면 ETA 텍스트에 var(--tj-imminent) 색이 적용된다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 2,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
  })

  it('liveMinutes > 3 이면 ETA 텍스트는 imminent 색이 아니어야 한다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 10,
      showLive: true,
    })
    const html = outerHTML(el)
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
    // arrive_in_seconds: 240 = 4분 (3분 이하는 "곧 도착"으로 표시되므로 4분 사용)
    const el = createSubwayMultiChipElement({
      subwayData: {
        up: { arrive_in_seconds: 240 },
        down: { arrive_in_seconds: 300 },
        line4_up: null,
        line4_down: { arrive_in_seconds: 360 },
      },
    })
    const html = outerHTML(el)
    expect(html).toContain('4분')
  })
})

// ============================================================
// 시안1 정보 밀도형 구조 테스트
// ============================================================

describe('시안1 — createMarkerChipElement 정보 밀도형 구조', () => {
  it('칩이 알약형(border-radius:999px)이어야 한다 (시안2 13px 아님)', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toMatch(/border-radius:\s*999px/)
    // 시안2 카드형 반경 없음
    expect(html).not.toMatch(/border-radius:\s*13px/)
  })

  it('dot 배지(data-role="dot")가 존재하고 노선색 배경이어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('data-role="dot"')
    // 20-1 기본 색 #2563EB — JSDOM은 rgb()로 변환하므로 style 프로퍼티로 확인
    const dot = el.querySelector('[data-role="dot"]')
    expect(dot.style.background).toMatch(/2563eb|rgb\(37,\s*99,\s*235\)/i)
  })

  it('dot 배지가 22x22 크기이어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const dot = el.querySelector('[data-role="dot"]')
    expect(dot).not.toBeNull()
    expect(dot.style.width).toBe('22px')
    expect(dot.style.height).toBe('22px')
  })

  it('name 영역(data-role="name")에 정류장명이 있어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    expect(html).toContain('data-role="name"')
    expect(html).toContain('정왕역')
  })

  it('showLive=true이면 live 영역(data-role="live")에 분 숫자가 렌더된다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '시흥시청',
      liveMinutes: 11,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('data-role="live"')
    expect(html).toContain('11')
  })

  it('showLive=true이면 blip(data-role="blip") 펄스 도트가 있어야 한다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 5,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('data-role="blip"')
  })

  it('showLive=false이면 sub 영역(data-role="sub")이 표시된다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      showLive: false,
      subLabel: '08:10 출발',
    })
    const html = outerHTML(el)
    expect(html).toContain('data-role="sub"')
    expect(html).toContain('08:10 출발')
  })

  it('liveMinutes <= 3이면 live 영역이 imminent 색을 가진다', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 2,
      showLive: true,
    })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
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

  it('live 영역 글자가 14px이어야 한다 (시안1 압축 크기)', () => {
    const el = createMarkerChipElement({
      routeCode: '20-1',
      stationName: '정왕역',
      liveMinutes: 8,
      showLive: true,
    })
    const live = el.querySelector('[data-role="live"]')
    expect(live).not.toBeNull()
    expect(live.style.fontSize).toBe('14px')
  })

  it('시안2 lead 블록(리드 분리 구조)이 없어야 한다', () => {
    const el = createMarkerChipElement({ routeCode: '20-1', stationName: '정왕역' })
    const html = outerHTML(el)
    // 시안1은 inline dot, 시안2의 분리된 lead 블록 없음
    expect(html).not.toContain('data-role="lead"')
  })
})

describe('시안1 — createSubwayMultiChipElement 정보 밀도형 구조', () => {
  it('칩이 알약형(border-radius:999px)이어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toMatch(/border-radius:\s*999px/)
    expect(html).not.toMatch(/border-radius:\s*13px/)
  })

  it('dot 배지(data-role="dot")가 존재해야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="dot"')
  })

  it('name 영역(data-role="name")이 존재해야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="name"')
  })

  it('꼬리(tail) 요소가 있어야 한다', () => {
    const el = createSubwayMultiChipElement({ subwayData: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="tail"')
  })

  it('subwayData가 있을 때 live 영역에 분 값이 렌더된다', () => {
    // 4분(240초): 3분 이하는 "곧 도착"으로 표시되므로 4분으로 테스트
    const el = createSubwayMultiChipElement({
      subwayData: { up: { arrive_in_seconds: 240 }, down: null, line4_up: null, line4_down: null },
    })
    const html = outerHTML(el)
    expect(html).toContain('data-role="live"')
    expect(html).toContain('4분')
  })
})

describe('시안1 — createSeohaeSiheungChipElement 정보 밀도형 구조', () => {
  it('칩이 알약형(border-radius:999px)이어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toMatch(/border-radius:\s*999px/)
    expect(html).not.toMatch(/border-radius:\s*13px/)
  })

  it('dot 배지(data-role="dot")가 서해선 색으로 존재해야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="dot"')
    const dot = el.querySelector('[data-role="dot"]')
    expect(dot.style.background).toMatch(/75bf43|rgb\(117,\s*191,\s*67\)/)
  })

  it('name 영역에 정류장명이 표시된다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="name"')
    expect(html).toContain('시흥시청역')
  })

  it('꼬리(tail) 요소가 있어야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="tail"')
  })

  it('upMinutes <= 3이면 imminent 색이 적용된다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 2, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('var(--tj-imminent)')
  })

  it('live 영역(data-role="live")이 존재해야 한다', () => {
    const el = createSeohaeSiheungChipElement({ stationName: '시흥시청역', upMinutes: 5, dnMinutes: 8, earliestBus: null })
    const html = outerHTML(el)
    expect(html).toContain('data-role="live"')
  })
})
