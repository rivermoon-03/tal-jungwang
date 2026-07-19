/**
 * directionAutoChangeToast.js — 자동 방향 전환 토스트 문구 헬퍼 테스트
 *
 * KST 시간대(아침/오후)에 따른 문구 생성을 검증한다.
 */
import { describe, it, expect } from 'vitest'
import { getDirectionAutoChangeMessage } from './directionAutoChangeToast'

// KST = UTC+9. UTC 시각을 넣어 KST 경계값을 검증한다.
function utc(dateStr) {
  return new Date(dateStr)
}

describe('getDirectionAutoChangeMessage', () => {
  it('KST 아침(13:59까지)에 등교 전환 시 아침 문구를 반환한다', () => {
    // KST 13:59 == UTC 04:59
    const message = getDirectionAutoChangeMessage('등교', utc('2026-07-17T04:59:00Z'))
    expect(message).toBe('아침이라서 등교로 전환했어요')
  })

  it('KST 오후(14:00부터)에 하교 전환 시 오후 문구를 반환한다', () => {
    // KST 14:00 == UTC 05:00
    // "오후"는 받침이 없으므로 "-라서" 사용
    const message = getDirectionAutoChangeMessage('하교', utc('2026-07-17T05:00:00Z'))
    expect(message).toBe('오후라서 하교로 전환했어요')
  })

  it('KST 자정(00:00) 직후 등교 전환 시 아침 문구를 반환한다(자정 넘김)', () => {
    // KST 00:00 == UTC 전날 15:00
    // "아침"은 받침이 있으므로 "-이라서" 사용
    const message = getDirectionAutoChangeMessage('등교', utc('2026-07-16T15:00:00Z'))
    expect(message).toBe('아침이라서 등교로 전환했어요')
  })

  it('KST 23:59 하교 전환 시 오후 문구를 반환한다', () => {
    // KST 23:59 == UTC 14:59
    // "오후"는 받침이 없으므로 "-라서" 사용
    const message = getDirectionAutoChangeMessage('하교', utc('2026-07-17T14:59:00Z'))
    expect(message).toBe('오후라서 하교로 전환했어요')
  })
})
