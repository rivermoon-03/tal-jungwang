import { describe, it, expect } from 'vitest'
import { toHistoryRows } from './historyAdapter'

// ── 공통 mock 데이터 ────────────────────────────────────────────────
// 변경 후: columns 3개 (어제, 이틀 전, 7일 전) / today(예정) 없음 / delta 없음

const makePreview = (overrides = {}) => ({
  route_number: '3100',
  columns: [
    {
      label: '어제',
      date: '2026-06-24',
      day_label: '6/24(수)',
      times: ['07:12', '07:48', '08:25'],
      totalCount: 3,
    },
    {
      label: '이틀 전',
      date: '2026-06-23',
      day_label: '6/23(화)',
      times: ['07:15', '07:50', '08:27'],
      totalCount: 3,
    },
    {
      label: '7일 전',
      date: '2026-06-18',
      day_label: '6/18(수)',
      times: ['07:10', '07:50', '08:22'],
      totalCount: 3,
    },
  ],
  realtime_eta: null,
  predicted_eta: { hhmm: '07:45', sample_size: 3, day_label: '평일' },
  ...overrides,
})

// now = 07:00
const now0700 = new Date('2026-06-25T07:00:00')

// ── 1. 기본 변환 ─────────────────────────────────────────────────────

describe('toHistoryRows — 기본 변환', () => {
  it('columns 3개 → rows를 반환한다', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('rows 수는 최대 2개다 (현재 시각 근처 1~2개)', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    expect(rows.length).toBeGreaterThanOrEqual(1)
    expect(rows.length).toBeLessThanOrEqual(2)
  })

  it('slot 필드가 존재한다', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    rows.forEach((row) => {
      expect(row).toHaveProperty('slot')
    })
  })

  it('모든 row에 today 필드가 없거나 없다 (오늘 컬럼 제거)', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    rows.forEach((row) => {
      // today 필드 자체가 없어야 함
      expect(row).not.toHaveProperty('today')
    })
  })

  it('delta 필드가 없거나 null이다 (delta verdict 제거)', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    rows.forEach((row) => {
      expect(row.delta == null).toBe(true)
    })
  })

  it('col0 → yesterday, col1 → dayBefore, col2 → lastWeek 매핑', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    expect(rows.length).toBeGreaterThan(0)
    rows.forEach((row) => {
      expect(row).toHaveProperty('yesterday')
      expect(row).toHaveProperty('dayBefore')
      expect(row).toHaveProperty('lastWeek')
    })
  })
})

// ── 2. now 기반 현재 시각대 매칭 ────────────────────────────────────

describe('toHistoryRows — now 기반 현재 시각대 매칭', () => {
  const bugPreview = {
    stop_name: '시흥시청역',
    columns: [
      {
        label: '어제',
        day_label: '6/24(수)',
        times: ['00:07', '00:29', '11:15', '11:40', '23:41'],
      },
      {
        label: '이틀 전',
        day_label: '6/23(화)',
        times: ['00:06', '00:28', '11:16', '11:41', '23:40'],
      },
      {
        label: '7일 전',
        day_label: '6/18(수)',
        times: ['00:08', '00:31', '11:18', '11:42', '23:38'],
      },
    ],
    realtime_eta: null,
    predicted_eta: { hhmm: '11:17', sample_size: 3, day_label: '평일' },
  }

  // now = 11:14
  const now1114 = new Date('2026-06-25T11:14:00')

  it('now 이전 시각은 매칭에서 제외한다', () => {
    const rows = toHistoryRows(bugPreview, now1114)
    // 00:07, 00:29 등은 11:14 이전이므로 제외 → yesterday[0] = 11:15
    expect(rows[0].yesterday).toBe('11:15')
  })

  it('dayBefore는 columns[1]의 now 이후 같은 인덱스 시각이다', () => {
    const rows = toHistoryRows(bugPreview, now1114)
    // columns[1]에서 11:14 이후 첫 시각 = 11:16
    expect(rows[0].dayBefore).toBe('11:16')
  })

  it('lastWeek는 columns[2]의 now 이후 같은 인덱스 시각이다', () => {
    const rows = toHistoryRows(bugPreview, now1114)
    // columns[2]에서 11:14 이후 첫 시각 = 11:18
    expect(rows[0].lastWeek).toBe('11:18')
  })

  it('rows 수는 최대 2개다', () => {
    const rows = toHistoryRows(bugPreview, now1114)
    expect(rows.length).toBeLessThanOrEqual(2)
  })

  it('모든 row에 today 필드가 없다', () => {
    const rows = toHistoryRows(bugPreview, now1114)
    rows.forEach((row) => {
      expect(row).not.toHaveProperty('today')
    })
  })
})

// ── 3. 빈/결함 데이터 처리 ─────────────────────────────────────────

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

  it('columns가 1개뿐이면 dayBefore/lastWeek는 null이다', () => {
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
    const rows = toHistoryRows(preview, now0700)
    expect(rows[0].yesterday).toBe('07:12')
    expect(rows[0].dayBefore).toBeNull()
    expect(rows[0].lastWeek).toBeNull()
  })

  it('columns가 2개면 lastWeek는 null이다', () => {
    const preview = makePreview({
      columns: [
        {
          label: '어제',
          date: '2026-06-24',
          day_label: '6/24(수)',
          times: ['07:12'],
          totalCount: 1,
        },
        {
          label: '이틀 전',
          date: '2026-06-23',
          day_label: '6/23(화)',
          times: ['07:14'],
          totalCount: 1,
        },
      ],
    })
    const rows = toHistoryRows(preview, now0700)
    expect(rows[0].yesterday).toBe('07:12')
    expect(rows[0].dayBefore).toBe('07:14')
    expect(rows[0].lastWeek).toBeNull()
  })

  it('now 이후 시각이 없으면 빈 배열을 반환한다', () => {
    const preview = makePreview({
      columns: [
        {
          label: '어제',
          date: '2026-06-24',
          day_label: '6/24(수)',
          times: ['07:12', '07:48'],
          totalCount: 2,
        },
        {
          label: '이틀 전',
          date: '2026-06-23',
          day_label: '6/23(화)',
          times: ['07:10', '07:46'],
          totalCount: 2,
        },
        {
          label: '7일 전',
          date: '2026-06-18',
          day_label: '6/18(수)',
          times: ['07:10', '07:50'],
          totalCount: 2,
        },
      ],
    })
    const now2350 = new Date('2026-06-25T23:50:00')
    const rows = toHistoryRows(preview, now2350)
    expect(rows).toEqual([])
  })

  it('predicted_eta/realtime_eta가 모두 null이어도 과거 기록은 반환한다', () => {
    const preview = makePreview({ realtime_eta: null, predicted_eta: null })
    const rows = toHistoryRows(preview, now0700)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].yesterday).toBeTruthy()
  })
})

// ── 4. 헤더 라벨 메타데이터 ─────────────────────────────────────────

describe('toHistoryRows — 컬럼 라벨 메타데이터', () => {
  it('반환값은 배열이다', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    expect(Array.isArray(rows)).toBe(true)
  })

  it('yesterday / dayBefore / lastWeek 필드가 각 row에 존재한다', () => {
    const rows = toHistoryRows(makePreview(), now0700)
    rows.forEach((row) => {
      expect(row).toHaveProperty('yesterday')
      expect(row).toHaveProperty('dayBefore')
      expect(row).toHaveProperty('lastWeek')
    })
  })
})
