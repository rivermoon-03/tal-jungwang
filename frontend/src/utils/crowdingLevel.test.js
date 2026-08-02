import { describe, it, expect } from 'vitest'
import { labelFromRatio, labelFromLevel, RATIO_THRESHOLDS } from './crowdingLevel'

describe('labelFromRatio — 혼잡(≥3) 비율 기준 라벨', () => {
  it('경계값을 아래 구간에 포함시키지 않는다', () => {
    expect(labelFromRatio(0.049)).toBe('여유')
    expect(labelFromRatio(0.05)).toBe('보통')
    expect(labelFromRatio(0.149)).toBe('보통')
    expect(labelFromRatio(0.15)).toBe('붐빔')
    expect(labelFromRatio(0.349)).toBe('붐빔')
    expect(labelFromRatio(0.35)).toBe('매우 붐빔')
  })

  it('0과 1 끝값을 처리한다', () => {
    expect(labelFromRatio(0)).toBe('여유')
    expect(labelFromRatio(1)).toBe('매우 붐빔')
  })

  it('값이 없으면 정보 없음이다 — 평균으로 추정하지 않는다', () => {
    expect(labelFromRatio(null)).toBe('정보 없음')
    expect(labelFromRatio(undefined)).toBe('정보 없음')
    expect(labelFromRatio(NaN)).toBe('정보 없음')
  })

  it('표본이 부족하면 등급을 단정하지 않는다', () => {
    expect(labelFromRatio(0.5, { reliable: false })).toBe('정보 부족')
  })

  it('프로덕션 실측이 의도한 등급으로 떨어진다', () => {
    // 시흥33 하교 · 한국공학대 (평일, 접근 1회 = 1표본)
    expect(labelFromRatio(0.466)).toBe('매우 붐빔') // 17시
    expect(labelFromRatio(0.308)).toBe('붐빔')      // 18시
    expect(labelFromRatio(0.089)).toBe('보통')      // 16시
    expect(labelFromRatio(0.004)).toBe('여유')      // 19시
  })

  it('임계 상수가 설계값(5/15/35%)과 일치한다', () => {
    expect(RATIO_THRESHOLDS).toEqual({ normal: 0.05, busy: 0.15, veryBusy: 0.35 })
  })
})

describe('labelFromLevel — 실시간 단일 차량 등급', () => {
  it('1~4를 고정 라벨로 옮긴다', () => {
    expect(labelFromLevel(1)).toBe('여유')
    expect(labelFromLevel(2)).toBe('보통')
    expect(labelFromLevel(3)).toBe('혼잡')
    expect(labelFromLevel(4)).toBe('매우혼잡')
  })

  it('0과 범위 밖은 라벨이 없다(칩을 그리지 않는다)', () => {
    expect(labelFromLevel(0)).toBeNull()
    expect(labelFromLevel(null)).toBeNull()
    expect(labelFromLevel(5)).toBeNull()
  })
})

describe('경험 기준 표기', () => {
  it('estimated면 출처를 문구에 붙인다', () => {
    expect(labelFromRatio(1, { estimated: true })).toBe('매우 붐빔 · 경험 기준')
    expect(labelFromLevel(3, { estimated: true })).toBe('혼잡 · 경험 기준')
  })

  it('estimated가 아니면 붙이지 않는다', () => {
    expect(labelFromRatio(1, { estimated: false })).toBe('매우 붐빔')
    expect(labelFromLevel(3, { estimated: false })).toBe('혼잡')
  })
})
