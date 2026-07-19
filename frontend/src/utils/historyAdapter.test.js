import { describe, it, expect } from 'vitest'
import { toHistoryRows, selectHistoryWindow, formatHHMMFromDate } from './historyAdapter'

// ═══════════════════════════════════════════════════════════════════
// selectHistoryWindow
// ═══════════════════════════════════════════════════════════════════

describe('selectHistoryWindow — 일반 케이스', () => {
  const records = ['07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30']

  it('가장 가까운 기록을 closest로 표시한다', () => {
    const now = new Date('2026-06-25T07:47:00')
    const window = selectHistoryWindow(records, now)
    const closest = window.find((w) => w.position === 'closest')
    expect(closest.time).toBe('07:45')
  })

  it('closest 이전 최대 2건, 이후 최대 3건(총 최대 6건)을 반환한다', () => {
    const now = new Date('2026-06-25T07:47:00')
    const window = selectHistoryWindow(records, now)
    expect(window.length).toBe(6)
    expect(window.map((w) => w.time)).toEqual([
      '07:15',
      '07:30',
      '07:45',
      '08:00',
      '08:15',
      '08:30',
    ])
    expect(window.map((w) => w.position)).toEqual([
      'past',
      'past',
      'closest',
      'after',
      'after',
      'after',
    ])
  })

  it('시간순으로 정렬된 상태로 반환한다', () => {
    const now = new Date('2026-06-25T07:47:00')
    const window = selectHistoryWindow(records, now)
    const times = window.map((w) => w.time)
    const sorted = [...times].sort()
    expect(times).toEqual(sorted)
  })
})

describe('selectHistoryWindow — 기록 부족 케이스 (패딩 없음)', () => {
  it('이전 기록이 1건뿐이면 1건만 반환한다', () => {
    const records = ['07:40', '07:45', '07:50']
    const now = new Date('2026-06-25T07:45:00')
    const window = selectHistoryWindow(records, now)
    // before=1(07:40), closest=07:45, after=1(07:50) → 총 3건
    expect(window.length).toBe(3)
    expect(window.map((w) => w.position)).toEqual(['past', 'closest', 'after'])
  })

  it('기록이 1건뿐이면 closest 하나만 반환한다', () => {
    const records = ['07:45']
    const now = new Date('2026-06-25T07:45:00')
    const window = selectHistoryWindow(records, now)
    expect(window.length).toBe(1)
    expect(window[0]).toMatchObject({ time: '07:45', position: 'closest' })
  })

  it('기록이 빈 배열이면 빈 배열을 반환한다', () => {
    expect(selectHistoryWindow([], new Date())).toEqual([])
  })

  it('records가 null/undefined면 빈 배열을 반환한다', () => {
    expect(selectHistoryWindow(null, new Date())).toEqual([])
    expect(selectHistoryWindow(undefined, new Date())).toEqual([])
  })

  it('파싱 불가능한 항목은 무시한다', () => {
    const records = ['07:00', 'invalid', null, '07:30']
    const now = new Date('2026-06-25T07:15:00')
    const window = selectHistoryWindow(records, now)
    expect(window.map((w) => w.time)).toEqual(['07:00', '07:30'])
  })
})

describe('selectHistoryWindow — 전부 이전/이후인 경우', () => {
  it('모든 기록이 now보다 이전이면 closest는 가장 늦은 기록이고 after는 없다', () => {
    const records = ['06:00', '06:10', '06:20', '06:30']
    const now = new Date('2026-06-25T08:00:00')
    const window = selectHistoryWindow(records, now)
    expect(window.map((w) => w.time)).toEqual(['06:10', '06:20', '06:30'])
    expect(window.map((w) => w.position)).toEqual(['past', 'past', 'closest'])
  })

  it('모든 기록이 now보다 이후면 closest는 가장 이른 기록이고 past는 없다', () => {
    const records = ['09:00', '09:10', '09:20', '09:30']
    const now = new Date('2026-06-25T08:00:00')
    const window = selectHistoryWindow(records, now)
    expect(window.map((w) => w.time)).toEqual(['09:00', '09:10', '09:20', '09:30'])
    expect(window.map((w) => w.position)).toEqual(['closest', 'after', 'after', 'after'])
  })
})

describe('selectHistoryWindow — 경계(동률) 케이스', () => {
  it('now와의 차이가 동률이면 더 이른 시각을 closest로 선택한다', () => {
    const records = ['07:00', '07:10']
    const now = new Date('2026-06-25T07:05:00') // 07:00과 07:10 모두 5분 차이
    const window = selectHistoryWindow(records, now)
    const closest = window.find((w) => w.position === 'closest')
    expect(closest.time).toBe('07:00')
  })

  it('자정 부근은 minutes-of-day 절대차로 단순 비교한다(순환 보정 없음)', () => {
    // now=00:05(5분), records: 23:55(1435분) vs 00:10(10분)
    // |1435-5|=1430, |10-5|=5 → 00:10이 절대차 기준 더 가깝다(순환 보정 없음)
    const records = ['23:55', '00:10']
    const now = new Date('2026-06-25T00:05:00')
    const window = selectHistoryWindow(records, now)
    const closest = window.find((w) => w.position === 'closest')
    expect(closest.time).toBe('00:10')
  })
})

describe('selectHistoryWindow — options 오버라이드', () => {
  it('beforeCount/afterCount/maxWindow을 옵션으로 조정할 수 있다', () => {
    const records = ['07:00', '07:10', '07:20', '07:30', '07:40', '07:50', '08:00', '08:10']
    const now = new Date('2026-06-25T07:35:00')
    const window = selectHistoryWindow(records, now, {
      beforeCount: 1,
      afterCount: 1,
      maxWindow: 3,
    })
    expect(window.map((w) => w.time)).toEqual(['07:20', '07:30', '07:40'])
  })
})

// ═══════════════════════════════════════════════════════════════════
// toHistoryRows
// ═══════════════════════════════════════════════════════════════════

const makePreview = (overrides = {}) => ({
  route_number: '3100',
  columns: [
    {
      label: '어제',
      date: '2026-06-24',
      day_label: '6/24(수)',
      times: ['07:12', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45'],
      totalCount: 7,
    },
    {
      label: '이틀 전',
      date: '2026-06-23',
      day_label: '6/23(화)',
      times: ['07:15', '07:32', '07:48', '08:02', '08:17', '08:33', '08:47'],
      totalCount: 7,
    },
    {
      label: '7일 전',
      date: '2026-06-18',
      day_label: '6/18(수)',
      times: ['07:10', '07:29', '07:46', '08:01', '08:16', '08:31', '08:44'],
      totalCount: 7,
    },
  ],
  realtime_eta: null,
  predicted_eta: { hhmm: '07:45', sample_size: 3, day_label: '평일' },
  ...overrides,
})

const now0745 = new Date('2026-06-25T07:45:00')

describe('toHistoryRows — 기본 변환', () => {
  it('columns 3개 → key가 yesterday/dayBefore/lastWeek인 3개 컬럼을 반환한다', () => {
    const rows = toHistoryRows(makePreview(), now0745)
    expect(rows.map((r) => r.key)).toEqual(['yesterday', 'dayBefore', 'lastWeek'])
  })

  it('각 컬럼은 최대 6건의 items를 갖는다', () => {
    const rows = toHistoryRows(makePreview(), now0745)
    rows.forEach((col) => {
      expect(col.items.length).toBeLessThanOrEqual(6)
    })
  })

  it('각 컬럼은 독립적으로 closest position을 하나만 갖는다', () => {
    const rows = toHistoryRows(makePreview(), now0745)
    rows.forEach((col) => {
      const closestCount = col.items.filter((i) => i.position === 'closest').length
      expect(closestCount).toBe(1)
    })
  })

  it('today 필드가 없다(오늘 컬럼 제거)', () => {
    const rows = toHistoryRows(makePreview(), now0745)
    expect(rows.find((r) => r.key === 'today')).toBeUndefined()
  })
})

describe('toHistoryRows — 빈/결함 데이터', () => {
  it('preview가 null이면 빈 배열을 반환한다', () => {
    expect(toHistoryRows(null)).toEqual([])
  })

  it('preview가 undefined이면 빈 배열을 반환한다', () => {
    expect(toHistoryRows(undefined)).toEqual([])
  })

  it('columns가 빈 배열이면 빈 배열을 반환한다', () => {
    expect(toHistoryRows({ columns: [], realtime_eta: null, predicted_eta: null })).toEqual([])
  })

  it('columns가 1개뿐이면 dayBefore/lastWeek 컬럼은 items가 빈 배열이다', () => {
    const preview = makePreview({
      columns: [
        {
          label: '어제',
          date: '2026-06-24',
          day_label: '6/24(수)',
          times: ['07:12'],
          totalCount: 1,
        },
      ],
    })
    const rows = toHistoryRows(preview, now0745)
    const yesterday = rows.find((r) => r.key === 'yesterday')
    const dayBefore = rows.find((r) => r.key === 'dayBefore')
    const lastWeek = rows.find((r) => r.key === 'lastWeek')
    expect(yesterday.items.length).toBe(1)
    expect(dayBefore.items).toEqual([])
    expect(lastWeek.items).toEqual([])
  })

  it('모든 컬럼의 times가 비어 있으면 빈 배열을 반환한다', () => {
    const preview = makePreview({
      columns: [
        { label: '어제', date: '2026-06-24', day_label: '6/24(수)', times: [], totalCount: 0 },
        { label: '이틀 전', date: '2026-06-23', day_label: '6/23(화)', times: [], totalCount: 0 },
        { label: '7일 전', date: '2026-06-18', day_label: '6/18(수)', times: [], totalCount: 0 },
      ],
    })
    const rows = toHistoryRows(preview, now0745)
    expect(rows).toEqual([])
  })

  it('predicted_eta/realtime_eta가 모두 null이어도 과거 기록은 반환한다', () => {
    const preview = makePreview({ realtime_eta: null, predicted_eta: null })
    const rows = toHistoryRows(preview, now0745)
    expect(rows.length).toBe(3)
    expect(rows[0].items.length).toBeGreaterThan(0)
  })
})

describe('toHistoryRows — 컬럼별 독립 매칭', () => {
  it('컬럼마다 각자의 now 기준 closest를 갖는다(서로 다른 시각 오프셋)', () => {
    const rows = toHistoryRows(makePreview(), now0745)
    const yesterday = rows.find((r) => r.key === 'yesterday')
    const dayBefore = rows.find((r) => r.key === 'dayBefore')
    const lastWeek = rows.find((r) => r.key === 'lastWeek')

    expect(yesterday.items.find((i) => i.position === 'closest').time).toBe('07:45')
    expect(dayBefore.items.find((i) => i.position === 'closest').time).toBe('07:48')
    expect(lastWeek.items.find((i) => i.position === 'closest').time).toBe('07:46')
  })
})

// ═══════════════════════════════════════════════════════════════════
// formatHHMMFromDate
// ═══════════════════════════════════════════════════════════════════

describe('formatHHMMFromDate', () => {
  it('Date를 "HH:MM" 문자열로 변환한다', () => {
    expect(formatHHMMFromDate(new Date('2026-06-25T07:05:00'))).toBe('07:05')
  })

  it('시/분을 2자리로 0-padding한다', () => {
    expect(formatHHMMFromDate(new Date('2026-06-25T00:05:00'))).toBe('00:05')
    expect(formatHHMMFromDate(new Date('2026-06-25T23:00:00'))).toBe('23:00')
  })
})
