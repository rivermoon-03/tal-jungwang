import { describe, it, expect } from 'vitest'
import { mergeToTwoHourBuckets, summarizeCrowding } from './crowdingSummary'

function hourly24(overrides = {}) {
  return Array.from({ length: 24 }, (_, hour) => (
    overrides[hour] ?? { hour, ratio: null, samples: 0, estimated: false, reliable: true }
  ))
}

function h(hour, ratio, samples = 50, extra = {}) {
  return { hour, ratio, samples, estimated: false, reliable: true, ...extra }
}

describe('mergeToTwoHourBuckets', () => {
  it('24개 시간 버킷을 12개 2시간 버킷으로 합친다', () => {
    const buckets = mergeToTwoHourBuckets(hourly24({ 8: h(8, 0.2, 10), 9: h(9, 0.4, 10) }))
    expect(buckets).toHaveLength(12)
    const b = buckets.find((x) => x.startHour === 8)
    expect(b.endHour).toBe(10)
    expect(b.samples).toBe(20)
    expect(b.ratio).toBeCloseTo(0.3)
  })

  it('표본 가중 평균 — 표본이 많은 쪽에 더 가깝다', () => {
    const buckets = mergeToTwoHourBuckets(hourly24({ 8: h(8, 0, 90), 9: h(9, 1.0, 10) }))
    expect(buckets.find((x) => x.startHour === 8).ratio).toBeCloseTo(0.1)
  })

  it('한쪽만 경험 기준이어도 버킷 전체가 경험 기준으로 표시된다', () => {
    const buckets = mergeToTwoHourBuckets(
      hourly24({ 16: h(16, 0.1), 17: h(17, 1.0, 50, { estimated: true }) })
    )
    expect(buckets.find((x) => x.startHour === 16).estimated).toBe(true)
  })

  it('표본이 없는 버킷은 ratio null', () => {
    expect(mergeToTwoHourBuckets(hourly24()).every((b) => b.ratio === null && b.samples === 0)).toBe(true)
  })

  it('빈/비배열 입력에도 12칸을 반환한다', () => {
    expect(mergeToTwoHourBuckets(null)).toHaveLength(12)
    expect(mergeToTwoHourBuckets([])).toHaveLength(12)
  })
})

describe('summarizeCrowding', () => {
  it('표본이 전혀 없으면 null', () => {
    expect(summarizeCrowding(hourly24(), 9)).toBeNull()
  })

  it('전부 같은 등급이면 hasVariance=false', () => {
    const s = summarizeCrowding(hourly24({ 8: h(8, 0.0), 9: h(9, 0.01), 18: h(18, 0.02) }), 8)
    expect(s.hasVariance).toBe(false)
    expect(s.nowLabel).toBe('여유')
  })

  it('피크를 1시간 해상도로 잡는다 — 조용한 옆 시간과 섞지 않는다', () => {
    // 시흥33 하교 실측: 16시 8.9%, 17시 46.6%, 18시 30.8%, 19시 0.4%
    const s = summarizeCrowding(
      hourly24({ 16: h(16, 0.089), 17: h(17, 0.466), 18: h(18, 0.308), 19: h(19, 0.004) }),
      19
    )
    expect(s.peak.hour).toBe(17)
    expect(s.peak.label).toBe('매우 붐빔')
    expect(s.nowLabel).toBe('여유')
    expect(s.hasVariance).toBe(true)
  })

  it('nowLabel은 시간 단위로 읽는다 — 2시간 버킷 평활을 타지 않는다', () => {
    const s = summarizeCrowding(hourly24({ 16: h(16, 0.089), 17: h(17, 0.466) }), 17)
    expect(s.nowLabel).toBe('매우 붐빔')
  })

  it('nowHour에 표본이 없으면 nowLabel은 null', () => {
    const s = summarizeCrowding(hourly24({ 8: h(8, 0.5) }), 20)
    expect(s.nowLabel).toBeNull()
    expect(s.peak.hour).toBe(8)
  })

  it('표본이 부족한 시간은 피크로 뽑지 않는다', () => {
    const s = summarizeCrowding(
      hourly24({ 3: h(3, 1.0, 2, { reliable: false }), 17: h(17, 0.4) }),
      17
    )
    expect(s.peak.hour).toBe(17)
  })

  it('경험 기준 피크는 문구에 출처가 붙는다', () => {
    const s = summarizeCrowding(hourly24({ 17: h(17, 1.0, 50, { estimated: true }) }), 17)
    expect(s.peak.label).toBe('매우 붐빔 · 경험 기준')
    expect(s.nowLabel).toBe('매우 붐빔 · 경험 기준')
  })
})
