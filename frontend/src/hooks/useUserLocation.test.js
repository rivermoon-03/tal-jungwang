import { describe, it, expect } from 'vitest'
import { getNearestStation } from './useUserLocation'

describe('getNearestStation', () => {
  it('한국공대 좌표 근처면 한국공학대 반환', () => {
    expect(getNearestStation(37.340, 126.733)).toBe('한국공학대')
  })
  it('시흥시청역 좌표면 시흥시청 반환', () => {
    expect(getNearestStation(37.3816, 126.8058)).toBe('시흥시청')
  })
  it('allowed 리스트에 없는 이름은 제외', () => {
    expect(
      getNearestStation(37.5665, 126.9780, ['한국공학대', '이마트']),
    ).toBe('이마트')
  })
})
