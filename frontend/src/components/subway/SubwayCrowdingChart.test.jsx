/**
 * SubwayCrowdingChart (B4) — 시간대 혼잡 차트.
 *
 * 핵심 단언:
 *   1. 데이터가 없으면(빈 배열/에러/로딩) 섹션 자체가 렌더되지 않는다
 *      — "실데이터 없는 동안 UI 미노출" 정책 (가짜 시드 금지).
 *   2. 데이터가 있으면 role="img" + aria-label 요약, 06~23시 18개 막대.
 *   3. 현재 시간대 막대만 bg-accent(불투명) + "N시" 라벨.
 *   4. 결론 한 줄: "{N}시대 붐빔 — {M}시 이후 여유 · 교통카드 통계 기준".
 *   5. 12px 미만 폰트(text-[8~11px]) 미사용.
 */
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { toDisplayLevels, summarizeCrowding, CROWDING_HOURS } from './crowdingProfile'

// useApi mock — 각 테스트에서 반환값을 바꾼다.
const useApiMock = vi.fn()
vi.mock('../../hooks/useApi', () => ({
  useApi: (...args) => useApiMock(...args),
}))

import SubwayCrowdingChart from './SubwayCrowdingChart'

const BASE_PROPS = { station: '정왕', lineName: '수인분당선', direction: '상행' }

// hour별 level 스펙을 [{hour, level}] 배열로 변환
function profile(spec) {
  return Object.entries(spec).map(([hour, level]) => ({ hour: Number(hour), level }))
}

beforeEach(() => {
  vi.useFakeTimers()
  // 2026-08-03(월) 08:30 KST — 현재 시간대 8시
  vi.setSystemTime(new Date(2026, 7, 3, 8, 30, 0))
  useApiMock.mockReset()
  useApiMock.mockReturnValue({ data: null, loading: false, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

// ── 순수 헬퍼 ─────────────────────────────────────────────────────────

describe('crowdingProfile 헬퍼', () => {
  it('toDisplayLevels — 06~23시 18칸, 빠진 시간대는 0', () => {
    const levels = toDisplayLevels(profile({ 8: 1.0, 18: 0.7 }))
    expect(levels).toHaveLength(18)
    expect(levels[0]).toEqual({ hour: 6, level: 0 })
    expect(levels.find((l) => l.hour === 8).level).toBe(1.0)
    expect(levels.find((l) => l.hour === 18).level).toBe(0.7)
  })

  it('summarizeCrowding — 최고 레벨 시간대와, 현재 이후 첫 여유(<0.4) 시각', () => {
    const levels = toDisplayLevels(profile({ 7: 0.6, 8: 1.0, 9: 0.5, 10: 0.39, 11: 0.2 }))
    const { peakHour, relaxedHour } = summarizeCrowding(levels, 8)
    expect(peakHour).toBe(8)
    expect(relaxedHour).toBe(10) // 0.39 < 0.4, 현재(8시) 이후 첫 시각
  })

  it('summarizeCrowding — 현재 이후 여유 구간이 없으면 relaxedHour=null', () => {
    const spec = {}
    for (const h of CROWDING_HOURS) spec[h] = 0.9
    const { relaxedHour } = summarizeCrowding(toDisplayLevels(profile(spec)), 8)
    expect(relaxedHour).toBeNull()
  })

  it('summarizeCrowding — 동률이면 이른 시간대가 피크', () => {
    const { peakHour } = summarizeCrowding(toDisplayLevels(profile({ 8: 1.0, 18: 1.0 })), 6)
    expect(peakHour).toBe(8)
  })
})

// ── 미렌더 정책 ───────────────────────────────────────────────────────

describe('SubwayCrowdingChart — 데이터 없으면 섹션 미렌더', () => {
  it('data=null(로딩/에러) → 아무것도 그리지 않는다', () => {
    useApiMock.mockReturnValue({ data: null, loading: true, error: null })
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.firstChild).toBeNull()
  })

  it('data=[](빈 테이블) → 아무것도 그리지 않는다', () => {
    useApiMock.mockReturnValue({ data: [], loading: false, error: null })
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.firstChild).toBeNull()
  })

  it('전부 level 0 인 퇴화 데이터 → 아무것도 그리지 않는다', () => {
    useApiMock.mockReturnValue({ data: profile({ 8: 0, 9: 0 }), loading: false, error: null })
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.firstChild).toBeNull()
  })

  it('모르는 노선명이면 fetch 자체를 끈다(enabled=false)', () => {
    useApiMock.mockReturnValue({ data: null, loading: false, error: null })
    render(<SubwayCrowdingChart {...BASE_PROPS} lineName="미지의선" />)
    expect(useApiMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ enabled: false })
    )
  })
})

// ── 렌더 ─────────────────────────────────────────────────────────────

const RICH_DATA = profile({
  6: 0.1, 7: 0.6, 8: 1.0, 9: 0.5, 10: 0.45, 11: 0.42, 12: 0.41,
  13: 0.45, 14: 0.4, 15: 0.45, 16: 0.5, 17: 0.7, 18: 0.9,
  19: 0.6, 20: 0.35, 21: 0.25, 22: 0.15, 23: 0.1,
})

describe('SubwayCrowdingChart — 데이터 있을 때', () => {
  beforeEach(() => {
    useApiMock.mockReturnValue({ data: RICH_DATA, loading: false, error: null })
  })

  it('올바른 path 로 조회한다 (line_id·direction 매핑)', () => {
    render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(useApiMock).toHaveBeenCalledWith(
      `/subway/crowding-profile?station=${encodeURIComponent('정왕')}&line=1075&direction=up`,
      expect.objectContaining({ enabled: true })
    )
  })

  it('role="img" + aria-label 요약이 있다', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    const img = container.querySelector('[role="img"]')
    expect(img).toBeTruthy()
    expect(img.getAttribute('aria-label')).toMatch(/시간대 혼잡/)
    expect(img.getAttribute('aria-label')).toMatch(/8시대 붐빔/)
  })

  it('06~23시 막대 18개가 그려진다', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.querySelectorAll('[data-hour]')).toHaveLength(18)
  })

  it('현재 시간대(8시) 막대만 bg-accent, 나머지는 bg-accent/30', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    const current = container.querySelector('[data-hour="8"]')
    expect(current.className).toMatch(/bg-accent(?!\/)/)
    const other = container.querySelector('[data-hour="9"]')
    expect(other.className).toMatch(/bg-accent\/30/)
  })

  it('현재 시간대 위에 "8시" 라벨(text-accent-ink)이 뜬다', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    const label = [...container.querySelectorAll('span')].find(
      (el) => el.textContent === '8시'
    )
    expect(label).toBeTruthy()
    expect(label.className).toMatch(/text-accent-ink/)
  })

  it('결론 한 줄: 피크·여유 시각 · 교통카드 통계 기준', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    // 피크 8시(1.0), 현재 8시 이후 level<0.4 첫 시각 = 20시(0.35).
    // em-dash 는 UI 텍스트 금지(tokenRules c항)라 구분자는 "·" 다.
    expect(container.textContent).toMatch(/8시대 붐빔 · 20시 이후 여유 · 교통카드 통계 기준/)
  })

  it('축 라벨은 06/10/14/18/22 만 노출된다', () => {
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    const twoDigit = [...container.querySelectorAll('span')]
      .map((el) => el.textContent.trim())
      .filter((t) => /^\d{2}$/.test(t))
    expect(twoDigit).toEqual(['06', '10', '14', '18', '22'])
  })

  it('심야(현재 3시)에는 강조 막대·"N시" 라벨이 없다', () => {
    vi.setSystemTime(new Date(2026, 7, 3, 3, 0, 0))
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    const solid = [...container.querySelectorAll('[data-hour]')].filter((el) =>
      /bg-accent(?!\/)/.test(el.className)
    )
    expect(solid).toHaveLength(0)
    const hourLabel = [...container.querySelectorAll('span')].find(
      (el) => el.textContent === '3시'
    )
    expect(hourLabel).toBeUndefined()
  })
})

// ── 디자인 토큰 규칙 ──────────────────────────────────────────────────

describe('SubwayCrowdingChart — 토큰 규칙', () => {
  it('12px 미만 폰트(text-[8~11px])가 없다', () => {
    useApiMock.mockReturnValue({ data: RICH_DATA, loading: false, error: null })
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })

  it('text-slate- / text-gray- 생색이 없다', () => {
    useApiMock.mockReturnValue({ data: RICH_DATA, loading: false, error: null })
    const { container } = render(<SubwayCrowdingChart {...BASE_PROPS} />)
    expect(container.innerHTML).not.toMatch(/text-(?:slate|gray)-/)
  })
})
