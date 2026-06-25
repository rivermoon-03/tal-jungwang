import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
} from './cafeteriaDays'

describe('buildDayLabelMap', () => {
  it('week_start와 year로 요일 라벨 맵을 생성한다', () => {
    const map = buildDayLabelMap('5.11', 2026, ['11', '12', '13', '14', '15'])
    // 2026-05-11은 월요일
    expect(map['11']).toBe('11일(월)')
    expect(map['12']).toBe('12일(화)')
    expect(map['13']).toBe('13일(수)')
    expect(map['14']).toBe('14일(목)')
    expect(map['15']).toBe('15일(금)')
  })

  it('weekStart가 없으면 빈 객체를 반환한다', () => {
    expect(buildDayLabelMap(null, 2026, ['11'])).toEqual({})
  })

  it('dayKeys가 비어있으면 빈 객체를 반환한다', () => {
    expect(buildDayLabelMap('5.11', 2026, [])).toEqual({})
  })

  it('숫자가 아닌 키는 건너뛴다', () => {
    const map = buildDayLabelMap('5.11', 2026, ['11', 'X'])
    expect(map['11']).toBeDefined()
    expect(map['X']).toBeUndefined()
  })
})

describe('getTodayDayKey', () => {
  beforeEach(() => {
    // 2026-05-13 KST (UTC 기준 2026-05-12 15:00 → KST 2026-05-13 00:00)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-13T00:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘 날짜 키를 반환한다', () => {
    const result = getTodayDayKey('5.11', 2026, ['11', '12', '13', '14', '15'])
    expect(result).toBe('13')
  })

  it('오늘이 dayKeys에 없으면 null을 반환한다', () => {
    const result = getTodayDayKey('5.11', 2026, ['11', '12'])
    expect(result).toBeNull()
  })

  it('year가 다르면 null을 반환한다', () => {
    const result = getTodayDayKey('5.11', 2025, ['13'])
    expect(result).toBeNull()
  })

  it('weekStart가 없으면 null을 반환한다', () => {
    expect(getTodayDayKey(null, 2026, ['13'])).toBeNull()
  })
})

describe('getFirstDayKey', () => {
  it('정렬된 첫 번째 키를 반환한다', () => {
    expect(getFirstDayKey(['13', '11', '12'])).toBe('11')
  })

  it('빈 배열이면 null을 반환한다', () => {
    expect(getFirstDayKey([])).toBeNull()
  })

  it('null이면 null을 반환한다', () => {
    expect(getFirstDayKey(null)).toBeNull()
  })
})

describe('extractDayKeys', () => {
  it('cafeteria meals의 by_day 키 합집합을 정렬해 반환한다', () => {
    const cafeteria = {
      meals: [
        { type: '중식', by_day: { '11': [], '12': [], '13': [] } },
        { type: '석식', by_day: { '11': [], '14': [], '15': [] } },
      ],
    }
    expect(extractDayKeys(cafeteria)).toEqual(['11', '12', '13', '14', '15'])
  })

  it('cafeteria가 null이면 빈 배열을 반환한다', () => {
    expect(extractDayKeys(null)).toEqual([])
  })

  it('meals가 비어있으면 빈 배열을 반환한다', () => {
    expect(extractDayKeys({ meals: [] })).toEqual([])
  })
})

describe('hasDayMenu', () => {
  const cafeteria = {
    meals: [
      { type: '중식', by_day: { '23': ['제육볶음', '미역국'], '24': [], '25': ['미운영'] } },
      { type: '석식', by_day: { '23': ['돈까스'], '24': [], '25': [] } },
    ],
  }

  it('실제 메뉴가 있는 날에 true를 반환한다', () => {
    expect(hasDayMenu(cafeteria, '23')).toBe(true)
  })

  it('모든 끼니가 빈 배열인 날에 false를 반환한다', () => {
    expect(hasDayMenu(cafeteria, '24')).toBe(false)
  })

  it('["미운영"] 단독인 날에 false를 반환한다', () => {
    expect(hasDayMenu(cafeteria, '25')).toBe(false)
  })

  it('dayKey가 by_day에 없으면 false를 반환한다', () => {
    expect(hasDayMenu(cafeteria, '99')).toBe(false)
  })

  it('cafeteria가 null이면 false를 반환한다', () => {
    expect(hasDayMenu(null, '23')).toBe(false)
  })

  it('meals가 비어있으면 false를 반환한다', () => {
    expect(hasDayMenu({ meals: [] }, '23')).toBe(false)
  })
})

describe('getNearestMenuDayKey', () => {
  // 2026-06-25 KST (수요일, 날짜=25)
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T10:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const cafeteria = {
    meals: [
      {
        type: '중식',
        by_day: {
          '23': ['제육볶음'],
          '24': ['돼지불고기'],
          '25': [],
          '26': [],
          '27': [],
        },
      },
    ],
  }
  const dayKeys = ['23', '24', '25', '26', '27']

  it('오늘(25일) 이후에 메뉴 없으면 오늘 이전 가장 최근 날(24일)을 반환한다', () => {
    const result = getNearestMenuDayKey('6.23', 2026, dayKeys, cafeteria)
    expect(result).toBe('24')
  })

  it('오늘 이후에 메뉴 있으면 해당 날을 반환한다', () => {
    const cafeteriaWithFuture = {
      meals: [
        {
          type: '중식',
          by_day: {
            '23': [],
            '24': [],
            '25': [],
            '26': ['치킨'],
            '27': [],
          },
        },
      ],
    }
    const result = getNearestMenuDayKey('6.23', 2026, dayKeys, cafeteriaWithFuture)
    expect(result).toBe('26')
  })

  it('오늘(25일)에 메뉴 있으면 오늘(25일)을 반환한다', () => {
    const cafeteriaWithToday = {
      meals: [
        {
          type: '중식',
          by_day: { '23': [], '24': [], '25': ['비빔밥'], '26': [], '27': [] },
        },
      ],
    }
    const result = getNearestMenuDayKey('6.23', 2026, dayKeys, cafeteriaWithToday)
    expect(result).toBe('25')
  })

  it('메뉴 있는 날이 하나도 없으면 getFirstDayKey 결과(23)를 반환한다', () => {
    const allEmpty = {
      meals: [
        {
          type: '중식',
          by_day: { '23': [], '24': [], '25': [], '26': [], '27': [] },
        },
      ],
    }
    const result = getNearestMenuDayKey('6.23', 2026, dayKeys, allEmpty)
    expect(result).toBe('23')
  })

  it('dayKeys가 빈 배열이면 null을 반환한다', () => {
    expect(getNearestMenuDayKey('6.23', 2026, [], cafeteria)).toBeNull()
  })
})

describe('isKstWeekend', () => {
  it('토요일(KST)이면 true를 반환한다', () => {
    // 2026-06-27 토요일 KST 정오
    const sat = new Date('2026-06-27T12:00:00+09:00')
    expect(isKstWeekend(sat)).toBe(true)
  })

  it('일요일(KST)이면 true를 반환한다', () => {
    // 2026-06-28 일요일 KST 정오
    const sun = new Date('2026-06-28T12:00:00+09:00')
    expect(isKstWeekend(sun)).toBe(true)
  })

  it('월요일(KST)이면 false를 반환한다', () => {
    // 2026-06-29 월요일 KST 정오
    const mon = new Date('2026-06-29T12:00:00+09:00')
    expect(isKstWeekend(mon)).toBe(false)
  })

  it('금요일(KST)이면 false를 반환한다', () => {
    // 2026-06-26 금요일 KST 정오
    const fri = new Date('2026-06-26T12:00:00+09:00')
    expect(isKstWeekend(fri)).toBe(false)
  })

  it('UTC 기준 일요일이지만 KST 월요일이면 false를 반환한다', () => {
    // UTC 일요일 16:00 = KST 월요일 01:00
    const borderline = new Date('2026-06-28T16:00:00Z')
    expect(isKstWeekend(borderline)).toBe(false)
  })

  it('인자 없이 호출 가능하다(기본값 new Date())', () => {
    // 예외 없이 boolean을 반환하는지만 확인
    expect(typeof isKstWeekend()).toBe('boolean')
  })
})
