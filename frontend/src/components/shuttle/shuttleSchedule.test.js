import { describe, it, expect } from 'vitest'
import { annotateShuttleEntries, buildShuttleGroups, parseReturnNote, buildDisplayList } from './shuttleSchedule'

describe('annotateShuttleEntries', () => {
  it('과거/다음/막차를 표시한 평평한 목록으로 변환한다', () => {
    const entries = ['08:00', '08:30', '09:00']
    const items = annotateShuttleEntries(entries, '08:15')
    expect(items).toEqual([
      { key: '08:00-0', time: '08:00', note: null, variant: null, isPast: true, isNext: false, isLast: false },
      { key: '08:30-1', time: '08:30', note: null, variant: null, isPast: false, isNext: true, isLast: false },
      { key: '09:00-2', time: '09:00', note: null, variant: null, isPast: false, isNext: false, isLast: true },
    ])
  })

  it('nowStr과 정확히 같은 시각은 과거로 취급하지 않는다(>= 아니라 < 비교)', () => {
    const items = annotateShuttleEntries(['08:00'], '08:00')
    expect(items[0].isPast).toBe(false)
    expect(items[0].isNext).toBe(true)
  })

  it('오늘 운행이 모두 지났으면 isNext가 모두 false다', () => {
    const items = annotateShuttleEntries(['08:00', '08:30'], '23:59')
    expect(items.every((it) => !it.isNext)).toBe(true)
  })

  it('객체 항목(depart_at/note/variant)을 그대로 옮긴다', () => {
    const items = annotateShuttleEntries(
      [{ depart_at: '08:40:00', note: '수시운행', variant: 'seasonal' }],
      '08:00'
    )
    expect(items[0]).toMatchObject({ time: '08:40', note: '수시운행', variant: 'seasonal' })
  })
})

describe('buildShuttleGroups', () => {
  it('연속된 수시운행 항목을 하나의 frequent 블록으로 묶는다', () => {
    const entries = annotateShuttleEntries(
      ['08:40', '08:50', '09:00'].map((t) => ({ depart_at: t, note: '수시운행' })),
      '00:00'
    )
    const groups = buildShuttleGroups(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ type: 'frequent' })
    expect(groups[0].items).toHaveLength(3)
  })

  it('연속된 회차편 항목을 하나의 return 블록으로 묶는다', () => {
    const entries = annotateShuttleEntries(
      ['17:10', '17:40'].map((t) => ({ depart_at: t, note: '회차편 · 학교 18:00 출발' })),
      '00:00'
    )
    const groups = buildShuttleGroups(entries)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ type: 'return' })
    expect(groups[0].items).toHaveLength(2)
  })

  it('일반 시각은 시(hour) 그룹으로 나눈다', () => {
    const entries = annotateShuttleEntries(['20:05', '20:25', '21:00'], '00:00')
    const groups = buildShuttleGroups(entries)
    expect(groups).toEqual([
      expect.objectContaining({ type: 'hour', hour: '20' }),
      expect.objectContaining({ type: 'hour', hour: '21' }),
    ])
  })

  it('시안 예시처럼 수시운행 → 시(hour) 그룹 → 회차편 순서를 그대로 보존한다', () => {
    const entries = annotateShuttleEntries(
      [
        { depart_at: '08:40', note: '수시운행' },
        { depart_at: '08:50', note: '수시운행' },
        { depart_at: '10:10', note: null },
        { depart_at: '17:10', note: '회차편 · 학교 18:00 출발' },
      ],
      '00:00'
    )
    const groups = buildShuttleGroups(entries)
    expect(groups.map((g) => g.type)).toEqual(['frequent', 'hour', 'return'])
  })
})

describe('parseReturnNote', () => {
  it('"회차편 · 학교 HH:MM 출발"에서 원편 시각을 뽑는다', () => {
    expect(parseReturnNote('회차편 · 학교 18:00 출발')).toEqual({
      isFrequentReturn: false,
      originTime: '18:00',
    })
  })

  it('원편이 수시운행 중이면 originTime은 null이다', () => {
    expect(parseReturnNote('회차편 · 학교 수시운행 출발')).toEqual({
      isFrequentReturn: true,
      originTime: null,
    })
  })

  it('note가 없으면 둘 다 기본값(false/null)이다', () => {
    expect(parseReturnNote(null)).toEqual({ isFrequentReturn: false, originTime: null })
    expect(parseReturnNote(undefined)).toEqual({ isFrequentReturn: false, originTime: null })
  })
})

describe('buildDisplayList', () => {
  it('연속된 수시운행 항목을 시작~끝 구간 하나로 묶는다', () => {
    const list = buildDisplayList([
      { depart_at: '08:40', note: '수시운행' },
      { depart_at: '08:50', note: '수시운행' },
      { depart_at: '10:00', note: null },
    ])
    expect(list).toEqual([
      expect.objectContaining({ type: 'frequent', startTime: '08:40', endTime: '08:50' }),
      expect.objectContaining({ type: 'fixed', time: '10:00' }),
    ])
  })

  it('일반 시각은 fixed 항목으로 variant를 유지한다', () => {
    const list = buildDisplayList([{ depart_at: '20:05', variant: 'seasonal' }])
    expect(list[0]).toMatchObject({ type: 'fixed', time: '20:05', variant: 'seasonal' })
  })
})
