/**
 * directionAutoChangeToast.js — 자동 방향 전환 토스트 문구 헬퍼 테스트
 *
 * 문구는 판정 근거(reason)를 그대로 말해야 한다. 결과값만 보고 시각으로
 * 역추론하면 위치 보정으로 바뀐 경우에 거짓 문구가 뜬다.
 */
import { describe, it, expect } from 'vitest'
import { getDirectionAutoChangeMessage } from './directionAutoChangeToast'

// KST = UTC+9. UTC 시각을 넣어 KST 경계값을 검증한다.
function utc(dateStr) {
  return new Date(dateStr)
}

describe('getDirectionAutoChangeMessage', () => {
  it('KST 13:59 는 오후다 — 판정 경계(14시)와 낱말 경계는 다르다', () => {
    // KST 13:59 == UTC 04:59. 방향 판정은 14시에 갈리지만 13시를 아침이라
    // 부르지는 않는다.
    const message = getDirectionAutoChangeMessage('등교', utc('2026-07-17T04:59:00Z'))
    expect(message).toBe('오후라서 등교로 전환했어요')
  })

  it('KST 오후(14:00부터)에 하교 전환 시 오후 문구를 반환한다', () => {
    // KST 14:00 == UTC 05:00
    // "오후"는 받침이 없으므로 "-라서" 사용
    const message = getDirectionAutoChangeMessage('하교', utc('2026-07-17T05:00:00Z'))
    expect(message).toBe('오후라서 하교로 전환했어요')
  })

  it('KST 자정 직후에는 시간대를 지어내지 않는다', () => {
    // KST 00:00 == UTC 전날 15:00. 예전엔 14시 경계 하나로 하루를 갈라
    // 01:30 에도 "아침이라서" 라고 말했다.
    const message = getDirectionAutoChangeMessage('등교', utc('2026-07-16T15:00:00Z'))
    expect(message).toBe('등교로 전환했어요')
  })

  it('KST 23:59 는 저녁이다', () => {
    const message = getDirectionAutoChangeMessage('하교', utc('2026-07-17T13:00:00Z'))
    expect(message).toBe('저녁이라서 하교로 전환했어요')
  })

  it('위치로 바뀐 경우 시각이 아니라 위치를 근거로 말한다', () => {
    // 오후 2시에 GPS 로 등교가 되면 예전엔 "오후라서 등교로 전환했어요" 가 떴다.
    const message = getDirectionAutoChangeMessage('등교', {
      reason: 'location',
      now: utc('2026-07-17T05:00:00Z'),
    })
    expect(message).toBe('학교 근처라서 등교로 전환했어요')
  })

  it('시각 근거는 낱말 경계를 따른다', () => {
    expect(getDirectionAutoChangeMessage('등교', { reason: 'time', now: utc('2026-07-17T01:00:00Z') }))
      .toBe('아침이라서 등교로 전환했어요')
    expect(getDirectionAutoChangeMessage('하교', { reason: 'time', now: utc('2026-07-17T05:00:00Z') }))
      .toBe('오후라서 하교로 전환했어요')
  })

  it('KST 23:59 는 말할 수 있는 시간대 밖이다', () => {
    // KST 23:59 == UTC 14:59
    const message = getDirectionAutoChangeMessage('하교', utc('2026-07-17T14:59:00Z'))
    expect(message).toBe('하교로 전환했어요')
  })
})
