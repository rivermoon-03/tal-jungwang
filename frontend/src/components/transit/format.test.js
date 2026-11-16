import { describe, it, expect } from 'vitest'
import { minutesLabel, stopsLabel, groupByHour, delayVerdict, historyDelta, isSoon } from './format'

describe('minutesLabel', () => {
  it('90초 미만은 곧 도착, 그 외는 반올림 분', () => {
    expect(minutesLabel(30)).toBe('곧 도착')
    expect(minutesLabel(150)).toBe('3분')
    expect(minutesLabel(null)).toBe(null)
  })
  it('3분 이하만 임박', () => {
    expect(isSoon(180)).toBe(true)
    expect(isSoon(181)).toBe(false)
  })
})

it('정거장 수는 1 이상일 때만 문구가 된다', () => {
  expect(stopsLabel(0)).toBe(null)
  expect(stopsLabel(4)).toBe('4정거장 전')
})

it('groupByHour 는 시간 단위로 묶고 정렬한다', () => {
  expect(groupByHour(['18:36', '17:05', '18:00'])).toEqual([
    { hour: 17, mins: [{ min: 5, total: 1025, raw: '17:05' }] },
    { hour: 18, mins: [{ min: 36, total: 1116, raw: '18:36' }, { min: 0, total: 1080, raw: '18:00' }] },
  ])
})

describe('delayVerdict', () => {
  it('경계값', () => {
    expect(delayVerdict(2)).toBe('평소와 비슷해요')
    expect(delayVerdict(-2)).toBe('평소와 비슷해요')
    expect(delayVerdict(4)).toBe('평소보다 조금 늦어요')
    expect(delayVerdict(-5)).toBe('평소보다 조금 빨라요')
    expect(delayVerdict(6)).toBe('평소보다 많이 늦어요')
  })
})

describe('historyDelta', () => {
  const cols = [{ times: ['18:00', '18:30'] }, { times: ['18:02'] }, { times: ['20:00'] }]
  it('30분 안 짝이 2개 이상이면 중앙값', () => {
    // now 18:00 + eta 4분 = 18:04 → 차이 4, 2 → 중앙값 3
    expect(historyDelta(cols, 240, 18 * 60)).toBe(3)
  })
  it('표본이 모자라면 null', () => {
    expect(historyDelta([{ times: ['18:00'] }], 240, 18 * 60)).toBe(null)
    expect(historyDelta(cols, null, 18 * 60)).toBe(null)
  })
})

it('nearestTime 은 지금과 가장 가까운 시각을 고른다', async () => {
  const { nearestTime } = await import('./format')
  expect(nearestTime(['07:38', '07:47', '08:32', '08:57'], 8 * 60 + 33)).toBe('08:32')
  expect(nearestTime(['08:20', '08:50'], 8 * 60 + 35)).toBe('08:20')
  expect(nearestTime([], 500)).toBe(null)
})
