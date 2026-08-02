import { describe, it, expect } from 'vitest'
import {
  PERIOD_VARIANTS,
  periodVariantKey,
  shortPeriodName,
  periodRangeLabel,
  pickCurrentPeriod,
  representativeWeekday,
  variantsInTimes,
  visiblePeriods,
} from './shuttlePeriods'

const P = (over = {}) => ({
  id: 1,
  period_type: 'VACATION',
  name: '여름방학 · 단축근무',
  start_date: '2026-07-14',
  end_date: '2026-08-24',
  priority: 110,
  ...over,
})

describe('periodVariantKey — 이름 기반 색상 분류', () => {
  it('계절학기 복합 기간은 계절학기(빨강)를 우선한다', () => {
    expect(periodVariantKey(P({ name: '여름방학 · 계절학기(정상근무)' }))).toBe('seasonal')
    expect(periodVariantKey(P({ name: '여름방학 · 계절학기(단축근무)' }))).toBe('seasonal')
  })

  it('단축근무/정상근무 기간을 구분한다', () => {
    expect(periodVariantKey(P({ name: '여름방학 · 단축근무' }))).toBe('reduced')
    expect(periodVariantKey(P({ name: '여름방학 · 정상근무' }))).toBe('normal')
  })

  it('학기 등 그 외 기간은 null', () => {
    expect(periodVariantKey(P({ name: '2026학년도 2학기' }))).toBe(null)
  })
})

describe('pickCurrentPeriod — 오늘 포함 기간 선택', () => {
  const periods = [
    P({ id: 1, name: '여름방학 · 계절학기(단축근무)', start_date: '2026-07-01', end_date: '2026-07-13' }),
    P({ id: 2, name: '여름방학 · 단축근무', start_date: '2026-07-14', end_date: '2026-08-24' }),
    P({ id: 3, name: '여름방학 · 정상근무', start_date: '2026-08-25', end_date: '2026-08-31' }),
  ]

  it('오늘(8/3)이 속한 단축근무 기간을 고른다', () => {
    expect(pickCurrentPeriod(periods, '2026-08-03')?.id).toBe(2)
  })

  it('겹치는 기간은 priority가 높은 쪽을 고른다', () => {
    const overlapped = [
      P({ id: 1, priority: 1, start_date: '2026-08-01', end_date: '2026-08-31' }),
      P({ id: 2, priority: 110, start_date: '2026-08-01', end_date: '2026-08-31' }),
    ]
    expect(pickCurrentPeriod(overlapped, '2026-08-03')?.id).toBe(2)
  })

  it('포함 기간이 없으면 null', () => {
    expect(pickCurrentPeriod(periods, '2026-09-15')).toBe(null)
  })
})

describe('representativeWeekday — 미리보기 대표 평일', () => {
  it('오늘이 기간 안 평일이면 오늘', () => {
    expect(representativeWeekday(P(), '2026-08-03')).toBe('2026-08-03') // 월
  })

  it('오늘이 기간 안 일요일이면 다음 평일', () => {
    expect(representativeWeekday(P(), '2026-08-02')).toBe('2026-08-03') // 일 → 월
  })

  it('미래 기간은 시작일부터 스캔 — 8/25(화) 시작이면 그대로', () => {
    const p4 = P({ start_date: '2026-08-25', end_date: '2026-08-31' })
    expect(representativeWeekday(p4, '2026-08-03')).toBe('2026-08-25')
  })

  it('토요일 시작 기간은 다음 월요일로 넘어간다', () => {
    const p = P({ start_date: '2026-08-01', end_date: '2026-08-24' }) // 8/1 토
    expect(representativeWeekday(p, '2026-07-01')).toBe('2026-08-03')
  })
})

describe('visiblePeriods — 칩 노출 필터', () => {
  const periods = [
    P({ id: 0, name: '2026학년도 1학기', start_date: '2026-03-03', end_date: '2026-06-22' }),
    P({ id: 1, name: '여름방학 · 계절학기(단축근무)', start_date: '2026-07-01', end_date: '2026-07-13' }),
    P({ id: 2, name: '여름방학 · 단축근무', start_date: '2026-07-14', end_date: '2026-08-24' }),
    P({ id: 3, name: '여름방학 · 정상근무', start_date: '2026-08-25', end_date: '2026-08-31' }),
  ]

  it('진행 중·미래는 남고 한참 지난 기간(1학기)은 걸러진다', () => {
    const ids = visiblePeriods(periods, '2026-08-02').map((p) => p.id)
    expect(ids).toEqual([2, 3])
  })

  it('끝난 지 2주 이내 기간은 아직 보인다', () => {
    const ids = visiblePeriods(periods, '2026-07-20').map((p) => p.id)
    expect(ids).toEqual([1, 2, 3])
  })
})

describe('표시 헬퍼', () => {
  it('shortPeriodName은 공통 접두어를 뗀다', () => {
    expect(shortPeriodName('여름방학 · 계절학기(단축근무)')).toBe('계절학기(단축근무)')
    expect(shortPeriodName('2026학년도 2학기')).toBe('2026학년도 2학기')
  })

  it('periodRangeLabel은 M/D~M/D', () => {
    expect(periodRangeLabel(P())).toBe('7/14~8/24')
  })

  it('variantsInTimes는 등장 variant를 순서대로 중복 없이 모은다', () => {
    const times = [
      { depart_at: '09:10', variant: null },
      { depart_at: '13:10', variant: 'seasonal' },
      { depart_at: '15:35', variant: 'reduced' },
      { depart_at: '15:50', variant: 'reduced' },
    ]
    expect(variantsInTimes(times)).toEqual(['seasonal', 'reduced'])
  })

  it('PERIOD_VARIANTS는 칩 팔레트 토큰만 쓴다(임의 hex 금지)', () => {
    for (const meta of Object.values(PERIOD_VARIANTS)) {
      expect(meta.chipClass).toMatch(/^bg-chip-\w+-bg text-chip-\w+-fg$/)
      expect(meta.dotClass).toMatch(/^bg-chip-\w+-fg$/)
    }
  })
})
