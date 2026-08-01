import { describe, it, expect } from 'vitest'
import { mergeToTwoHourBuckets, summarizeCrowding } from './crowdingSummary'

function hourly24(overrides = {}) {
  return Array.from({ length: 24 }, (_, hour) => (
    overrides[hour] ?? { hour, crowded: null, samples: 0 }
  ))
}

describe('mergeToTwoHourBuckets', () => {
  it('24개 시간 버킷을 12개 2시간 버킷으로 합친다', () => {
    const hourly = hourly24({
      8: { hour: 8, crowded: 2.0, samples: 10 },
      9: { hour: 9, crowded: 3.0, samples: 10 },
    })
    const buckets = mergeToTwoHourBuckets(hourly)
    expect(buckets).toHaveLength(12)
    const b48 = buckets.find((b) => b.startHour === 8)
    expect(b48.endHour).toBe(10)
    expect(b48.samples).toBe(20)
    expect(b48.crowded).toBeCloseTo(2.5)
  })

  it('표본 가중 평균 — 표본이 많은 쪽에 더 가깝다', () => {
    const hourly = hourly24({
      8: { hour: 8, crowded: 1.0, samples: 90 },
      9: { hour: 9, crowded: 4.0, samples: 10 },
    })
    const buckets = mergeToTwoHourBuckets(hourly)
    const b = buckets.find((b) => b.startHour === 8)
    expect(b.crowded).toBeCloseTo(1.3)
  })

  it('표본이 없는 버킷은 crowded null', () => {
    const buckets = mergeToTwoHourBuckets(hourly24())
    expect(buckets.every((b) => b.crowded === null && b.samples === 0)).toBe(true)
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

  it('전부 같은 등급(여유)이면 hasVariance=false', () => {
    const hourly = hourly24({
      8: { hour: 8, crowded: 1.0, samples: 50 },
      9: { hour: 9, crowded: 1.1, samples: 50 },
      18: { hour: 18, crowded: 1.05, samples: 50 },
    })
    const s = summarizeCrowding(hourly, 8)
    expect(s.hasVariance).toBe(false)
    expect(s.nowLabel).toBe('여유')
  })

  it('등급이 갈리면 hasVariance=true, peak이 가장 혼잡한 구간을 가리킨다', () => {
    const hourly = hourly24({
      8: { hour: 8, crowded: 3.6, samples: 50 },
      9: { hour: 9, crowded: 3.8, samples: 50 },
      14: { hour: 14, crowded: 1.0, samples: 50 },
    })
    const s = summarizeCrowding(hourly, 14)
    expect(s.hasVariance).toBe(true)
    expect(s.peak.startHour).toBe(8)
    expect(s.peak.endHour).toBe(10)
    expect(s.peak.label).toBe('매우혼잡')
    expect(s.nowLabel).toBe('여유')
  })

  it('nowHour가 표본 없는 버킷을 가리키면 nowLabel은 null', () => {
    const hourly = hourly24({ 8: { hour: 8, crowded: 3.0, samples: 20 } })
    const s = summarizeCrowding(hourly, 20)
    expect(s.nowLabel).toBeNull()
    // peak 자체는 여전히 계산됨
    expect(s.peak.startHour).toBe(8)
  })
})
