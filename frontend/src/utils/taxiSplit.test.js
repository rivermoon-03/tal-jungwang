import { describe, it, expect } from 'vitest'
import { splitFare, formatWon } from './taxiSplit'

describe('splitFare', () => {
  it('나누어떨어지는 경우 올림 없음', () => {
    expect(splitFare(10000, 2)).toBe(5000)
    expect(splitFare(12000, 3)).toBe(4000)
  })

  it('올림이 필요한 경우 100원 단위로 올림', () => {
    expect(splitFare(10001, 2)).toBe(5100)
    expect(splitFare(10050, 2)).toBe(5100)
    expect(splitFare(10099, 2)).toBe(5100)
  })

  it('1인 분할', () => {
    expect(splitFare(5000, 1)).toBe(5000)
    expect(splitFare(5050, 1)).toBe(5100)
  })

  it('0원은 0으로 반환', () => {
    expect(splitFare(0, 2)).toBe(0)
    expect(splitFare(0, 100)).toBe(0)
  })

  it('null 인자는 null 반환', () => {
    expect(splitFare(null, 2)).toBe(null)
    expect(splitFare(5000, null)).toBe(null)
    expect(splitFare(null, null)).toBe(null)
  })

  it('음수나 0 인원은 null 반환', () => {
    expect(splitFare(5000, 0)).toBe(null)
    expect(splitFare(5000, -1)).toBe(null)
  })

  it('큰 금액의 올림', () => {
    expect(splitFare(100001, 3)).toBe(33400)
  })
})

describe('formatWon', () => {
  it('천 단위 콤마로 포맷하고 원 단위 추가', () => {
    expect(formatWon(1000)).toBe('1,000원')
    expect(formatWon(10000)).toBe('10,000원')
    expect(formatWon(1000000)).toBe('1,000,000원')
  })

  it('작은 금액도 포맷', () => {
    expect(formatWon(100)).toBe('100원')
    expect(formatWon(50)).toBe('50원')
    expect(formatWon(5)).toBe('5원')
  })

  it('0은 0원', () => {
    expect(formatWon(0)).toBe('0원')
  })

  it('null은 빈 문자열', () => {
    expect(formatWon(null)).toBe('')
  })
})
