import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
  isMenuWeekStale,
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

describe('isMenuWeekStale — 지난주 식단 판정', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('오늘이 주차 마지막 날 이후면 stale', () => {
    // 주차 7/27(월)~8/1(토), 오늘 8/2(일) KST
    vi.setSystemTime(new Date('2026-08-02T12:00:00+09:00'))
    expect(isMenuWeekStale('7.27', 2026, ['27', '28', '29', '30', '31', '1'])).toBe(true)
  })

  it('오늘이 주차 안이면 stale 아님 (월 경계 포함)', () => {
    // 같은 주차, 오늘 8/1(토) KST — dayKeys의 '1'이 8월로 넘어간 날
    vi.setSystemTime(new Date('2026-08-01T12:00:00+09:00'))
    expect(isMenuWeekStale('7.27', 2026, ['27', '28', '29', '30', '31', '1'])).toBe(false)
  })

  it('주차 시작 전(다음 주 식단 선게시)이면 stale 아님', () => {
    vi.setSystemTime(new Date('2026-08-02T12:00:00+09:00'))
    expect(isMenuWeekStale('8.3', 2026, ['3', '4', '5', '6', '7'])).toBe(false)
  })

  it('입력이 비면 false', () => {
    expect(isMenuWeekStale(null, 2026, ['1'])).toBe(false)
    expect(isMenuWeekStale('7.27', 2026, [])).toBe(false)
  })
})

describe('월 경계 주차 (8/31~9/5) — 실제 날짜 기준 처리', () => {
  // 2026-08-31(월) ~ 2026-09-05(토). by_day 키는 day-of-month라 숫자순으로
  // 정렬하면 '31'이 맨 뒤로 밀리고, 9월 키들의 요일도 8월로 계산돼 어긋난다.
  const weekStart = '8.31'
  const year = 2026
  const dayKeys = ['31', '1', '2', '3', '4', '5']

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-01T09:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('요일 라벨이 실제 날짜 기준으로 매겨진다', () => {
    const map = buildDayLabelMap(weekStart, year, dayKeys)
    expect(map['31']).toBe('31일(월)')
    expect(map['1']).toBe('1일(화)')
    expect(map['2']).toBe('2일(수)')
    expect(map['3']).toBe('3일(목)')
    expect(map['4']).toBe('4일(금)')
    expect(map['5']).toBe('5일(토)')
  })

  it('9/1이 오늘로 잡힌다', () => {
    expect(getTodayDayKey(weekStart, year, dayKeys)).toBe('1')
  })

  it('키 정렬이 31 → 1 → 2 순서가 된다', () => {
    const cafeteria = {
      meals: [{ type: '중식', by_day: { 31: [], 1: [], 2: [], 3: [], 4: [], 5: [] } }],
    }
    expect(extractDayKeys(cafeteria, weekStart, year)).toEqual(['31', '1', '2', '3', '4', '5'])
    expect(getFirstDayKey(dayKeys, weekStart, year)).toBe('31')
  })

  it('주차 안이므로 stale이 아니다', () => {
    expect(isMenuWeekStale(weekStart, year, dayKeys)).toBe(false)
  })

  it('오늘 메뉴가 없으면 다음 메뉴 있는 날(2일)로 폴백한다', () => {
    const cafeteria = {
      meals: [{ type: '중식', by_day: { 31: ['칼국수'], 1: [], 2: ['스팸마요덮밥'], 3: [], 4: [], 5: [] } }],
    }
    expect(getNearestMenuDayKey(weekStart, year, dayKeys, cafeteria)).toBe('2')
  })
})
