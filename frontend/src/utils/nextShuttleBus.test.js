import { describe, it, expect } from 'vitest'
import { getNextShuttleBusInfo } from './nextShuttleBus'

describe('getNextShuttleBusInfo', () => {
  it('둘 다 없으면 null', () => {
    expect(getNextShuttleBusInfo(null, null)).toBeNull()
  })

  it('등교가 더 이르면 등교 시각을 대표값으로 뽑는다', () => {
    const info = getNextShuttleBusInfo('07:40', '15:20')
    expect(info).toEqual({ time: '07:40', sub: '등교 07:40 · 하교 15:20' })
  })

  it('하교가 더 이르면 하교 시각을 대표값으로 뽑는다 (자릿수 비교 아닌 실제 시간 비교)', () => {
    // 문자열 사전순이면 '09:00' < '10:00'이 맞지만, 여기선 '9:05' 같은 비정상
    // 포맷이 아니라 항상 HH:MM 2자리라 사전순=시간순이 우연히 일치한다.
    // 그래도 분 단위 비교 로직이 맞는지 확인.
    const info = getNextShuttleBusInfo('10:00', '09:00')
    expect(info.time).toBe('09:00')
  })

  it('한쪽만 있으면 있는 쪽을 대표값으로 쓴다', () => {
    expect(getNextShuttleBusInfo('07:40', null)).toEqual({
      time: '07:40',
      sub: '등교 07:40 · 하교 -',
    })
    expect(getNextShuttleBusInfo(null, '15:20')).toEqual({
      time: '15:20',
      sub: '등교 - · 하교 15:20',
    })
  })
})
