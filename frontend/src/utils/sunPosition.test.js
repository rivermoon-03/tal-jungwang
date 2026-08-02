/**
 * sunPosition.test.js — 태양 고도 계산 검증.
 *
 * 기준값은 정왕동(37.34N, 126.73E)의 실제 일출/일몰 시각이다. 고도 계산이
 * 어긋나면 히어로 배경이 통째로 엉뚱한 시간대를 그리므로, 계절이 정반대인
 * 두 날(하지 무렵 · 동지 무렵)을 함께 본다.
 *
 * CI는 TZ=Asia/Seoul로 고정돼 있지만 이 계산 자체는 epoch 기준이라 타임존과
 * 무관하다. 그래도 의도를 분명히 하려고 KST 오프셋(+09:00)을 명시해 쓴다.
 */
import { describe, it, expect } from 'vitest'
import { getSunAltitude, getSunPhase, getSunDayProgress, JEONGWANG } from './sunPosition'

const kst = (iso) => new Date(`${iso}+09:00`)

describe('getSunAltitude — 계절별 남중고도', () => {
  it('하지 무렵 정오의 남중고도는 약 76도다', () => {
    // 남중고도 = 90 - 위도 + 적위(23.44) = 90 - 37.34 + 23.44 ≈ 76.1
    const alt = getSunAltitude(kst('2026-06-21T12:30:00'))
    expect(alt).toBeGreaterThan(74)
    expect(alt).toBeLessThan(78)
  })

  it('동지 무렵 정오의 남중고도는 약 29도다', () => {
    // 90 - 37.34 - 23.44 ≈ 29.2
    const alt = getSunAltitude(kst('2025-12-21T12:30:00'))
    expect(alt).toBeGreaterThan(27)
    expect(alt).toBeLessThan(31)
  })

  it('한밤중에는 고도가 크게 음수다', () => {
    expect(getSunAltitude(kst('2026-08-02T02:00:00'))).toBeLessThan(-20)
  })
})

describe('getSunAltitude — 일출·일몰 시각', () => {
  // 지평선(고도 0)을 지나는 시각을 1분 간격으로 훑어 찾는다.
  function findCrossing(dateIso, fromHour, toHour) {
    let prev = getSunAltitude(kst(`${dateIso}T${String(fromHour).padStart(2, '0')}:00:00`))
    for (let minute = 1; minute <= (toHour - fromHour) * 60; minute++) {
      const h = fromHour + Math.floor(minute / 60)
      const m = minute % 60
      const stamp = `${dateIso}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
      const alt = getSunAltitude(kst(stamp))
      if (prev < 0 && alt >= 0) return stamp
      if (prev > 0 && alt <= 0) return stamp
      prev = alt
    }
    return null
  }

  it('8월 초 일출은 05:30~05:50 사이다', () => {
    const sunrise = findCrossing('2026-08-02', 4, 7)
    expect(sunrise).toMatch(/T05:[34]\d/)
  })

  it('8월 초 일몰은 19:20~19:45 사이다', () => {
    const sunset = findCrossing('2026-08-02', 18, 21)
    expect(sunset).toMatch(/T19:[234]\d/)
  })

  it('12월 하순 일출은 8월보다 훨씬 늦다(07시대)', () => {
    const sunrise = findCrossing('2025-12-22', 6, 9)
    expect(sunrise).toMatch(/T07:\d\d/)
  })
})

describe('getSunDayProgress', () => {
  it('남중(정오 무렵)에 0.5 근처다', () => {
    // 정왕동은 동경 126.73도라 표준자오선(135도)보다 서쪽 — 남중이 12시보다 늦다.
    const p = getSunDayProgress(kst('2026-08-02T12:40:00'))
    expect(p).toBeGreaterThan(0.47)
    expect(p).toBeLessThan(0.53)
  })

  it('한밤중에는 0 또는 1 근처다(자정 경계)', () => {
    const p = getSunDayProgress(kst('2026-08-02T00:40:00'))
    expect(Math.min(p, 1 - p)).toBeLessThan(0.05)
  })

  it('오전은 0.5보다 작고 오후는 0.5보다 크다', () => {
    expect(getSunDayProgress(kst('2026-08-02T08:00:00'))).toBeLessThan(0.5)
    expect(getSunDayProgress(kst('2026-08-02T17:00:00'))).toBeGreaterThan(0.5)
  })
})

describe('getSunPhase', () => {
  it('시민박명보다 어두우면 night다', () => {
    expect(getSunPhase(-7)).toBe('night')
    expect(getSunPhase(-40)).toBe('night')
  })

  it('박명~낮은 해 구간은 evening이다', () => {
    expect(getSunPhase(-5)).toBe('evening')
    expect(getSunPhase(0)).toBe('evening')
    expect(getSunPhase(7.9)).toBe('evening')
  })

  it('해가 충분히 높으면 day다', () => {
    expect(getSunPhase(8)).toBe('day')
    expect(getSunPhase(60)).toBe('day')
  })
})

describe('관측지 좌표', () => {
  it('정왕동 좌표를 기본값으로 쓴다', () => {
    expect(JEONGWANG.lat).toBeCloseTo(37.34, 1)
    expect(JEONGWANG.lon).toBeCloseTo(126.73, 1)
  })
})
