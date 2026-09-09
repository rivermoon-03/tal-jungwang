import { describe, it, expect } from 'vitest'
import { describeEtaAccuracy, shouldShowAccuracy, formatOffset, BIAS_MIN_SEC, SPREAD_MIN_SEC } from './etaAccuracy'

// 2026-09-09 프로덕션 bus_eta_accuracy 실측값. 이 값들로 문구가 말이 되는지 본다.
const PROD = {
  '5602 시흥시청역(서울방향)': { sample_size: 9491, mae_sec: 134, bias_sec: 111, within60_ratio: 0.33 },
  '시흥33 한국공학대학교':      { sample_size: 11982, mae_sec: 125, bias_sec: 58, within60_ratio: 0.35 },
  '3401 시흥시청역(서울방향)':  { sample_size: 6048, mae_sec: 122, bias_sec: -78, within60_ratio: 0.37 },
  '20-1 한국공학대학교':       { sample_size: 7608, mae_sec: 132, bias_sec: 6, within60_ratio: 0.35 },
  '5200 시화터미널':          { sample_size: 1032, mae_sec: 46, bias_sec: -9, within60_ratio: 0.76 },
  '3400 이마트':             { sample_size: 344, mae_sec: 47, bias_sec: 21, within60_ratio: 0.75 },
}

describe('describeEtaAccuracy', () => {
  it('꾸준히 늦는 노선은 여유를 두라고 말한다', () => {
    const r = describeEtaAccuracy(PROD['5602 시흥시청역(서울방향)'])
    expect(r.tone).toBe('late')
    expect(r.text).toBe('예보보다 평균 1분 51초 늦게 와요 · 여유 있게')
  })

  it('꾸준히 일찍 오는 노선은 일찍 나가라고 말한다', () => {
    const r = describeEtaAccuracy(PROD['3401 시흥시청역(서울방향)'])
    expect(r.tone).toBe('early')
    expect(r.text).toBe('예보보다 평균 1분 18초 일찍 와요 · 조금 일찍 나가세요')
  })

  it('편향은 없는데 흩어져 있으면 그렇게 말한다', () => {
    // 20-1 은 중앙 오차가 1초로 거의 무편향인데 MAE 는 132초다.
    const r = describeEtaAccuracy(PROD['20-1 한국공학대학교'])
    expect(r.tone).toBe('spread')
    expect(r.text).toContain('들쭉날쭉')
  })

  it('잘 맞는 노선에는 아무 말도 하지 않는다', () => {
    // 조용한 것이 기본값이다. 전부에게 같은 경고를 띄우면 정보가 아니다.
    expect(describeEtaAccuracy(PROD['5200 시화터미널'])).toBeNull()
    expect(describeEtaAccuracy(PROD['3400 이마트'])).toBeNull()
  })

  it('프로덕션 14개 조합 중 어느 것도 적중률 퍼센트를 노출하지 않는다', () => {
    for (const a of Object.values(PROD)) {
      const r = describeEtaAccuracy(a)
      if (r) expect(r.text).not.toMatch(/%/)
    }
  })

  it('값이 없거나 깨졌으면 null 이다', () => {
    expect(describeEtaAccuracy(null)).toBeNull()
    expect(describeEtaAccuracy(undefined)).toBeNull()
    expect(describeEtaAccuracy({})).toBeNull()
    expect(describeEtaAccuracy({ bias_sec: 'x', mae_sec: 'y' })).toBeNull()
  })

  it('경계값', () => {
    expect(describeEtaAccuracy({ bias_sec: BIAS_MIN_SEC, mae_sec: 40 }).tone).toBe('late')
    expect(describeEtaAccuracy({ bias_sec: BIAS_MIN_SEC - 1, mae_sec: 40 })).toBeNull()
    expect(describeEtaAccuracy({ bias_sec: -BIAS_MIN_SEC, mae_sec: 40 }).tone).toBe('early')
    expect(describeEtaAccuracy({ bias_sec: 0, mae_sec: SPREAD_MIN_SEC }).tone).toBe('spread')
    expect(describeEtaAccuracy({ bias_sec: 0, mae_sec: SPREAD_MIN_SEC - 1 })).toBeNull()
  })
})

describe('shouldShowAccuracy', () => {
  it('코앞에 온 버스에는 붙이지 않는다 — 할 수 있는 게 없다', () => {
    const late = PROD['5602 시흥시청역(서울방향)']
    expect(shouldShowAccuracy(late, 60)).toBe(false)
    expect(shouldShowAccuracy(late, 119)).toBe(false)
    expect(shouldShowAccuracy(late, 120)).toBe(true)
    expect(shouldShowAccuracy(late, 720)).toBe(true)
  })

  it('남은 초를 모르면 말할 것이 있는지로만 판단한다', () => {
    expect(shouldShowAccuracy(PROD['5602 시흥시청역(서울방향)'], null)).toBe(true)
    expect(shouldShowAccuracy(PROD['5200 시화터미널'], null)).toBe(false)
  })
})

describe('formatOffset', () => {
  it('60초 미만은 초로만 말한다', () => {
    expect(formatOffset(21)).toBe('21초')
    expect(formatOffset(-9)).toBe('9초')
  })
  it('분 단위로 떨어지면 분만 말한다', () => {
    expect(formatOffset(120)).toBe('2분')
  })
  it('나머지가 있으면 분과 초를 함께 말한다', () => {
    expect(formatOffset(111)).toBe('1분 51초')
    expect(formatOffset(-78)).toBe('1분 18초')
  })
})
