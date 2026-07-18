import { describe, it, expect } from 'vitest'
import { mergeToHourly, crowdedToneStyle, isWeekendNow } from './crowdingHeatmap'

describe('mergeToHourly', () => {
  it('같은 시간대(hour)의 30분 버킷들을 표본가중 평균한다', () => {
    const result = mergeToHourly([
      { hour: 8, minute: 0, crowded: 2, samples: 10 },
      { hour: 8, minute: 30, crowded: 4, samples: 10 },
    ])
    expect(result[8].crowded).toBeCloseTo(3)
    expect(result[8].samples).toBe(20)
  })

  it('표본 수가 다르면 가중 평균이 큰 쪽으로 쏠린다(단순 평균과 달라야 함)', () => {
    const result = mergeToHourly([
      { hour: 8, minute: 0, crowded: 1, samples: 1 },
      { hour: 8, minute: 30, crowded: 4, samples: 9 },
    ])
    // 단순평균이면 2.5, 표본가중이면 3.7에 가까움
    expect(result[8].crowded).toBeCloseTo(3.7, 1)
  })

  it('데이터 없는 시간대는 crowded=null, samples=0', () => {
    const result = mergeToHourly([{ hour: 5, minute: 0, crowded: 2, samples: 5 }])
    expect(result).toHaveLength(24)
    expect(result[0].crowded).toBeNull()
    expect(result[0].samples).toBe(0)
  })

  it('points가 빈 배열/undefined/null이어도 24개 null 버킷을 반환', () => {
    expect(mergeToHourly([])).toHaveLength(24)
    expect(mergeToHourly(undefined).every((b) => b.crowded === null)).toBe(true)
    expect(mergeToHourly(null).every((b) => b.crowded === null)).toBe(true)
  })

  it('범위 밖 hour/결측 항목은 무시하고 크래시하지 않는다', () => {
    const result = mergeToHourly([
      { hour: 30, minute: 0, crowded: 2, samples: 5 },
      { hour: -1, minute: 0, crowded: 2, samples: 5 },
      null,
      { hour: 9, minute: 0, crowded: null, samples: null },
    ])
    expect(result.filter((b) => b.hour !== 9).every((b) => b.samples === 0)).toBe(true)
    // samples가 null(0으로 취급)이면 해당 시간대도 데이터 없음 취급
    expect(result[9].crowded).toBeNull()
  })
})

describe('crowdedToneStyle', () => {
  it('null이면 데이터 없음 스타일(className만, 인라인 배경색 없음)', () => {
    const tone = crowdedToneStyle(null)
    expect(tone.style).toBeUndefined()
    expect(tone.className).toContain('bg-surface-2')
  })

  it('1~4 범위를 벗어난 값도 clamp되어 색을 만든다(크래시하지 않음)', () => {
    const low = crowdedToneStyle(0)
    const high = crowdedToneStyle(10)
    expect(low.style.backgroundColor).toContain('var(--tj-ease)')
    expect(high.style.backgroundColor).toContain('var(--tj-delayed)')
  })

  it('낮은 값일수록 ease 비중이, 높은 값일수록 delayed 비중이 커진다', () => {
    const easeHeavy = crowdedToneStyle(1.2)
    const delayedHeavy = crowdedToneStyle(3.8)
    expect(easeHeavy.style.backgroundColor).toMatch(/var\(--tj-ease\) 8\d%/)
    expect(delayedHeavy.style.backgroundColor).toMatch(/var\(--tj-delayed\) 8\d%/)
  })

  it('색은 항상 var(--tj-*) 토큰 기반이며 하드코딩 hex를 포함하지 않는다', () => {
    for (const v of [1, 1.5, 2, 2.5, 3, 3.5, 4]) {
      const tone = crowdedToneStyle(v)
      expect(tone.style.backgroundColor).toMatch(/^color-mix\(in srgb, var\(--tj-/)
      expect(tone.style.backgroundColor).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    }
  })
})

describe('isWeekendNow', () => {
  it('토요일/일요일은 true', () => {
    expect(isWeekendNow(new Date('2026-07-18T12:00:00+09:00'))).toBe(true) // 토
    expect(isWeekendNow(new Date('2026-07-19T12:00:00+09:00'))).toBe(true) // 일
  })

  it('평일은 false', () => {
    expect(isWeekendNow(new Date('2026-07-20T12:00:00+09:00'))).toBe(false) // 월
  })
})
