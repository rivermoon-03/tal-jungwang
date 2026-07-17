/**
 * venueOpen.test.js — isOpenNow() TDD 테스트
 * KST 기준 영업중/마감임박/마감 판정 + 휴무일 처리
 */
import { describe, it, expect } from 'vitest'
import { isOpenNow, getVenueBuilding, getBuildingColor, getCategoryStyle, isVacationPeriod, getCategoryIcon } from './venueOpen'

// ---------- 테스트용 venue fixtures ----------

/** 단순 단일 시간대 장소 (매일 11:00~20:00) */
const simpleVenue = {
  name: '테스트장소',
  hours: [{ start: '11:00', end: '20:00' }],
  closedDays: [],
}

/** 조/중/석 3끼 장소 */
const mealVenue = {
  name: '학생식당',
  meals: [
    { type: '조식', start: '08:30', end: '09:20' },
    { type: '중식', start: '11:00', end: '14:00' },
    { type: '석식', start: '17:00', end: '18:50' },
  ],
  closedDays: ['sunday'],
}

/** 24시간 장소 */
const alwaysOpen = {
  name: 'GS25',
  alwaysOpen: true,
  closedDays: [],
}

/** 마감임박 (1시간 내) 테스트용 — 11:00~12:00 */
const closingVenue = {
  name: '마감임박테스트',
  hours: [{ start: '11:00', end: '12:00' }],
  closedDays: [],
}

/** 평일 only 장소 */
const weekdayOnly = {
  name: '평일장소',
  hours: [{ start: '10:00', end: '20:00' }],
  closedDays: ['saturday', 'sunday'],
}

// ---------- KST 시각 생성 헬퍼 ----------
// KST = UTC+9. vi.setSystemTime을 쓰지 않고 Date 직접 생성
function kst(year, month, day, hour, minute) {
  // month는 1-indexed로 받아 Date 생성
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute))
}

// ---------- 기존 테스트 (status 필드만 체크 — 이전 'open'|'closing'|'closed') ----------

describe('isOpenNow — 기본 단일 시간대', () => {
  it('영업 시간 중에는 open을 반환해요', () => {
    // 화요일 15:00 KST
    const now = kst(2026, 6, 23, 15, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.open).toBe(true)
    expect(result.status).toBe('open')
  })

  it('마감 후에는 after_close를 반환해요', () => {
    // 화요일 21:00 KST
    const now = kst(2026, 6, 23, 21, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('after_close')
  })

  it('영업 시작 전에는 before_open을 반환해요', () => {
    // 화요일 09:00 KST
    const now = kst(2026, 6, 23, 9, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('before_open')
  })
})

describe('isOpenNow — 마감임박(1시간 이내)', () => {
  it('마감 59분 전이면 closing을 반환해요', () => {
    // 11:01 KST — 마감까지 59분
    const now = kst(2026, 6, 23, 11, 1)
    const result = isOpenNow(closingVenue, now)
    expect(result.open).toBe(true)
    expect(result.status).toBe('closing')
  })

  it('마감 정확히 1시간 전이면 open(마감임박 아님)을 반환해요', () => {
    // 11:00 KST — 마감까지 정확히 60분
    const now = kst(2026, 6, 23, 11, 0)
    const result = isOpenNow(closingVenue, now)
    expect(result.open).toBe(true)
    expect(result.status).toBe('open')
  })

  it('마감임박 시 nextChange에 마감 시각이 담겨요', () => {
    const now = kst(2026, 6, 23, 11, 30)
    const result = isOpenNow(closingVenue, now)
    expect(result.status).toBe('closing')
    expect(result.nextChange).toBe('12:00')
  })
})

describe('isOpenNow — 24시간', () => {
  it('alwaysOpen 장소는 항상 open을 반환해요', () => {
    const now = kst(2026, 6, 23, 3, 0)
    const result = isOpenNow(alwaysOpen, now)
    expect(result.open).toBe(true)
    expect(result.status).toBe('always')
  })
})

describe('isOpenNow — 휴무일', () => {
  it('일요일 휴무 장소는 일요일에 closed_day를 반환해요', () => {
    // 2026-06-28 = 일요일
    const now = kst(2026, 6, 28, 12, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('closed_day')
  })

  it('토/일 휴무 장소는 토요일에 closed_day를 반환해요', () => {
    // 2026-06-27 = 토요일
    const now = kst(2026, 6, 27, 12, 0)
    const result = isOpenNow(weekdayOnly, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('closed_day')
  })

  it('휴무일 아닌 날에는 정상 판정해요', () => {
    // 2026-06-23 = 화요일 12:00
    const now = kst(2026, 6, 23, 12, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(true)
    expect(result.status).toMatch(/^(open|closing)$/)
  })
})

describe('isOpenNow — meals 구조(학식)', () => {
  it('중식 시간 중에는 open을 반환해요', () => {
    // 화요일 12:30
    const now = kst(2026, 6, 23, 12, 30)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(true)
  })

  it('끼니 사이(틈새) 시간에는 after_close 또는 before_open을 반환해요', () => {
    // 화요일 10:00 — 조식(08:30~09:20) 끝나고 중식(11:00) 전
    const now = kst(2026, 6, 23, 10, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toMatch(/^(after_close|before_open)$/)
  })
})

// ---------- 신규: primaryLabel / subLabel 테스트 ----------

describe('isOpenNow — primaryLabel', () => {
  it('24시간 장소 primaryLabel은 "24시간 영업"이에요', () => {
    const now = kst(2026, 6, 23, 3, 0)
    const result = isOpenNow(alwaysOpen, now)
    expect(result.primaryLabel).toBe('24시간 영업')
  })

  it('영업 중 primaryLabel은 "영업 중"이에요', () => {
    const now = kst(2026, 6, 23, 15, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.primaryLabel).toBe('영업 중')
  })

  it('마감임박 primaryLabel은 "영업 중"이에요', () => {
    const now = kst(2026, 6, 23, 11, 30)
    const result = isOpenNow(closingVenue, now)
    expect(result.primaryLabel).toBe('영업 중')
  })

  it('영업 전 primaryLabel은 "영업 전"이에요', () => {
    // 화요일 09:00, simpleVenue(11:00 시작)
    const now = kst(2026, 6, 23, 9, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.primaryLabel).toBe('영업 전')
  })

  it('영업 종료 primaryLabel은 "영업 종료"에요', () => {
    // 화요일 21:00, simpleVenue(20:00 종료)
    const now = kst(2026, 6, 23, 21, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.primaryLabel).toBe('영업 종료')
  })

  it('휴무일 primaryLabel은 "오늘 휴무"에요', () => {
    // 2026-06-28 일요일
    const now = kst(2026, 6, 28, 12, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.primaryLabel).toBe('오늘 휴무')
  })
})

describe('isOpenNow — subLabel (스마트 안내)', () => {
  it('24시간 장소 subLabel은 null이에요', () => {
    const now = kst(2026, 6, 23, 3, 0)
    const result = isOpenNow(alwaysOpen, now)
    expect(result.subLabel).toBeNull()
  })

  it('마감임박 시 subLabel에 "HH:MM 영업 종료"가 들어요', () => {
    // 11:30 KST, closingVenue(12:00 종료)
    const now = kst(2026, 6, 23, 11, 30)
    const result = isOpenNow(closingVenue, now)
    expect(result.subLabel).toBe('12:00 영업 종료')
  })

  it('마감 1시간 이상 남은 경우 subLabel에 "HH:MM 영업 종료"가 들어요', () => {
    // 15:00 KST, simpleVenue(20:00 종료) — 5시간 남음
    const now = kst(2026, 6, 23, 15, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.subLabel).toBe('20:00 영업 종료')
  })

  it('영업 전 59분 미만 남은 경우 subLabel에 "N분 후 영업 시작"이 들어요', () => {
    // 화요일 10:30 KST, simpleVenue(11:00 시작) — 30분 후
    const now = kst(2026, 6, 23, 10, 30)
    const result = isOpenNow(simpleVenue, now)
    expect(result.subLabel).toBe('30분 후 영업 시작')
  })

  it('영업 전 60분 이상 남은 경우 subLabel에 "N시간 M분 후 영업 시작"이 들어요', () => {
    // 화요일 09:00 KST, simpleVenue(11:00 시작) — 120분(2시간) 후
    const now = kst(2026, 6, 23, 9, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.subLabel).toBe('2시간 후 영업 시작')
  })

  it('영업 전 1시간 30분 남은 경우 "N시간 M분 후 영업 시작"이에요', () => {
    // 화요일 09:30 KST, simpleVenue(11:00 시작) — 90분(1시간 30분) 후
    const now = kst(2026, 6, 23, 9, 30)
    const result = isOpenNow(simpleVenue, now)
    expect(result.subLabel).toBe('1시간 30분 후 영업 시작')
  })

  it('영업 종료 후 당일 다음 끼니 없으면 "다음 날 HH:MM 영업 시작"이에요', () => {
    // 화요일 21:00 KST, simpleVenue — 다음 날 수요일 11:00
    const now = kst(2026, 6, 23, 21, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.subLabel).toBe('다음 날 11:00 영업 시작')
  })

  it('끼니 사이(조식 후, 중식 전)에 다음 끼니 안내가 들어요', () => {
    // 화요일 10:00 KST, mealVenue — 조식(~09:20) 끝, 중식(11:00~) 전
    const now = kst(2026, 6, 23, 10, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.subLabel).toBe('1시간 후 영업 시작')
  })

  it('휴무일 subLabel에 다음 영업 날 안내가 들어요', () => {
    // 2026-06-28 일요일(휴무), mealVenue — 다음 날 월요일 08:30
    const now = kst(2026, 6, 28, 12, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.subLabel).toBe('다음 날 08:30 영업 시작')
  })

  it('토요일 휴무 장소 — 다음 영업 월요일 안내', () => {
    // 2026-06-27 토요일(주말 휴무 weekdayOnly) — 월요일 10:00
    const now = kst(2026, 6, 27, 12, 0)
    const result = isOpenNow(weekdayOnly, now)
    // 토->일(휴무)->월(영업), 2일 후 = "월요일 10:00 영업 시작"
    expect(result.subLabel).toBe('월요일 10:00 영업 시작')
  })
})

// ---------- 신규: currentPart (영업 중인 끼니 파트 식별) ----------

describe('isOpenNow — currentPart (현재 영업 파트)', () => {
  it('meals 구조: 중식 시간 중 currentPart.type이 "중식"이에요', () => {
    // 화요일 12:30 KST — 중식(11:00~14:00) 범위
    const now = kst(2026, 6, 23, 12, 30)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart).toBeDefined()
    expect(result.currentPart.type).toBe('중식')
    expect(result.currentPart.end).toBe('14:00')
  })

  it('meals 구조: 조식 시간 중 currentPart.type이 "조식"이에요', () => {
    // 화요일 08:50 KST — 조식(08:30~09:20) 범위
    const now = kst(2026, 6, 23, 8, 50)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart).toBeDefined()
    expect(result.currentPart.type).toBe('조식')
    expect(result.currentPart.end).toBe('09:20')
  })

  it('meals 구조: 석식 시간 중 currentPart.type이 "석식"이에요', () => {
    // 화요일 18:00 KST — 석식(17:00~18:50) 범위
    const now = kst(2026, 6, 23, 18, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart).toBeDefined()
    expect(result.currentPart.type).toBe('석식')
    expect(result.currentPart.end).toBe('18:50')
  })

  it('영업 중 아닌 시각에는 currentPart가 null이에요', () => {
    // 화요일 10:00 KST — 끼니 사이 (조식 끝, 중식 전)
    const now = kst(2026, 6, 23, 10, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(false)
    expect(result.currentPart).toBeNull()
  })

  it('hours 구조(단일): currentPart.type은 null이에요', () => {
    // 화요일 15:00 KST, simpleVenue — 파트 type 없는 단일 시간대
    const now = kst(2026, 6, 23, 15, 0)
    const result = isOpenNow(simpleVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart).toBeDefined()
    expect(result.currentPart.type).toBeNull()
    expect(result.currentPart.end).toBe('20:00')
  })

  it('alwaysOpen 장소 currentPart는 null이에요', () => {
    const now = kst(2026, 6, 23, 3, 0)
    const result = isOpenNow(alwaysOpen, now)
    expect(result.currentPart).toBeNull()
  })

  it('휴무일 currentPart는 null이에요', () => {
    // 2026-06-28 일요일 휴무
    const now = kst(2026, 6, 28, 12, 0)
    const result = isOpenNow(mealVenue, now)
    expect(result.open).toBe(false)
    expect(result.currentPart).toBeNull()
  })
})

// ---------- 신규: getVenueBuilding / getBuildingColor ----------

describe('getVenueBuilding — location → 건물 추출', () => {
  it('"TIP B1" → "TIP"', () => {
    expect(getVenueBuilding('TIP B1')).toBe('TIP')
  })

  it('"TIP 1층" → "TIP"', () => {
    expect(getVenueBuilding('TIP 1층')).toBe('TIP')
  })

  it('"TIP 2층" → "TIP"', () => {
    expect(getVenueBuilding('TIP 2층')).toBe('TIP')
  })

  it('"TIP" (단독) → "TIP"', () => {
    expect(getVenueBuilding('TIP')).toBe('TIP')
  })

  it('"푸드코트 TIP B1" → "TIP"', () => {
    expect(getVenueBuilding('푸드코트 TIP B1')).toBe('TIP')
  })

  it('"E동 1층" → "E동"', () => {
    expect(getVenueBuilding('E동 1층')).toBe('E동')
  })

  it('"중앙도서관 1층" → "중앙도서관"', () => {
    expect(getVenueBuilding('중앙도서관 1층')).toBe('중앙도서관')
  })

  it('알 수 없는 위치는 "기타"로 반환해요', () => {
    expect(getVenueBuilding('알 수 없는 곳')).toBe('기타')
  })
})

describe('getBuildingColor — 건물 → 색상 객체', () => {
  it('TIP 건물은 color/bg 객체를 반환해요', () => {
    const c = getBuildingColor('TIP')
    expect(c).toHaveProperty('color')
    expect(c).toHaveProperty('bg')
  })

  it('E동 건물은 color/bg 객체를 반환해요', () => {
    const c = getBuildingColor('E동')
    expect(c).toHaveProperty('color')
    expect(c).toHaveProperty('bg')
  })

  it('중앙도서관은 color/bg 객체를 반환해요', () => {
    const c = getBuildingColor('중앙도서관')
    expect(c).toHaveProperty('color')
    expect(c).toHaveProperty('bg')
  })

  it('TIP / E동 / 중앙도서관은 서로 다른 색이에요', () => {
    const tip = getBuildingColor('TIP')
    const e = getBuildingColor('E동')
    const lib = getBuildingColor('중앙도서관')
    expect(tip.color).not.toBe(e.color)
    expect(tip.color).not.toBe(lib.color)
    expect(e.color).not.toBe(lib.color)
  })

  it('기타 건물도 fallback color/bg 객체를 반환해요', () => {
    const c = getBuildingColor('기타')
    expect(c).toHaveProperty('color')
    expect(c).toHaveProperty('bg')
  })

  // Phase B(2026-07): 카테고리 칩 팔레트를 CSS 변수(--tj-chip-*)로 일원화하면서
  // 라이트/다크 전환이 .dark 스코프에서 자동 처리되도록 바뀜.
  // 더 이상 darkColor/darkBg를 별도로 반환하지 않고, color/bg 자체가 var()를 참조한다.
  it('color/bg는 --tj-chip-* CSS 변수를 참조해요 (다크모드 자동 전환)', () => {
    const buildings = ['TIP', 'E동', '중앙도서관', '기타']
    buildings.forEach((b) => {
      const { color, bg } = getBuildingColor(b)
      expect(color).toMatch(/^var\(--tj-chip-.+-fg\)$/)
      expect(bg).toMatch(/^var\(--tj-chip-.+-bg\)$/)
    })
  })
})

describe('getCategoryStyle — 카테고리 → 색상 객체', () => {
  it('알려진 카테고리는 --tj-chip-* CSS 변수를 반환해요', () => {
    const categories = ['한식', '중식', '분식', '양식', '패스트푸드', '카페', '편의점']
    categories.forEach((c) => {
      const { color, bg } = getCategoryStyle(c)
      expect(color).toMatch(/^var\(--tj-chip-.+-fg\)$/)
      expect(bg).toMatch(/^var\(--tj-chip-.+-bg\)$/)
    })
  })

  it('알 수 없는 카테고리는 gray로 폴백해요', () => {
    const { color, bg } = getCategoryStyle('없는카테고리')
    expect(color).toBe('var(--tj-chip-gray-fg)')
    expect(bg).toBe('var(--tj-chip-gray-bg)')
  })
})

// ────────────────────────────────────────────────────────────────────
// 신규: isVacationPeriod — 학기/방학 기간 판정
// ────────────────────────────────────────────────────────────────────

describe('isVacationPeriod — 학기/방학 판정', () => {
  it('6월 25일(방학 시작 직후)은 방학이에요', () => {
    // 2026-06-25 = 방학(하계: 6/22~8/31)
    expect(isVacationPeriod(new Date('2026-06-25T09:00:00+09:00'))).toBe(true)
  })

  it('8월 31일(방학 마지막 날)은 방학이에요', () => {
    expect(isVacationPeriod(new Date('2026-08-31T09:00:00+09:00'))).toBe(true)
  })

  it('9월 1일(개강)은 방학이 아니에요', () => {
    expect(isVacationPeriod(new Date('2026-09-01T09:00:00+09:00'))).toBe(false)
  })

  it('12월 22일(동계방학 시작)은 방학이에요', () => {
    expect(isVacationPeriod(new Date('2026-12-22T09:00:00+09:00'))).toBe(true)
  })

  it('2월 28일(동계방학 마지막 날)은 방학이에요', () => {
    expect(isVacationPeriod(new Date('2027-02-28T09:00:00+09:00'))).toBe(true)
  })

  it('3월 1일은 방학이 아니에요(학기)', () => {
    expect(isVacationPeriod(new Date('2027-03-01T09:00:00+09:00'))).toBe(false)
  })

  it('5월 중순(학기 중)은 방학이 아니에요', () => {
    expect(isVacationPeriod(new Date('2026-05-15T09:00:00+09:00'))).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────
// 신규: getCategoryIcon — 카테고리 → 아이콘 매핑
// ────────────────────────────────────────────────────────────────────

// lucide-react 아이콘은 forwardRef 객체(typeof === 'object')로 export됨.
// render 프로퍼티가 함수인지로 React 컴포넌트 여부를 확인한다.
function isReactComponent(val) {
  return val != null && (typeof val === 'function' || typeof val.render === 'function')
}

describe('getCategoryIcon — 카테고리 → lucide 아이콘', () => {
  it('한식 → UtensilsCrossed(React 컴포넌트)를 반환해요', () => {
    const Icon = getCategoryIcon('한식')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('분식 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('분식')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('중식 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('중식')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('양식 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('양식')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('패스트푸드 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('패스트푸드')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('카페 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('카페')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('편의점 → React 컴포넌트를 반환해요', () => {
    const Icon = getCategoryIcon('편의점')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('알 수 없는 카테고리도 React 컴포넌트(fallback)를 반환해요', () => {
    const Icon = getCategoryIcon('알수없음')
    expect(isReactComponent(Icon)).toBe(true)
  })

  it('한식과 카페는 서로 다른 아이콘 컴포넌트를 반환해요', () => {
    expect(getCategoryIcon('한식')).not.toBe(getCategoryIcon('카페'))
  })
})

// ────────────────────────────────────────────────────────────────────
// 신규: schedule 구조 + 학기/방학 판정 통합 (isOpenNow)
// ────────────────────────────────────────────────────────────────────

// schedule 구조 venue 픽스처 (학생식당 참고)
const scheduleVenue = {
  id: 'test-schedule-venue',
  name: '스케줄테스트식당',
  building: 'TIP',
  floor: 'B1',
  category: '한식',
  is24h: false,
  closedDays: ['sunday'],
  schedule: {
    semester: {
      weekday: [
        { type: '조식', start: '08:30', end: '09:20' },
        { type: '중식', start: '11:00', end: '14:00' },
        { type: '석식', start: '17:00', end: '18:50' },
      ],
      saturday: [
        { type: '중식', start: '11:00', end: '14:00' },
      ],
      sunday: [],
    },
    vacation: {
      weekday: [
        { type: '조식', start: '09:00', end: '10:00' },
        { type: '중식', start: '11:00', end: '14:00' },
        { type: '석식', start: '17:00', end: '18:50' },
      ],
      saturday: [
        { type: '중식', start: '11:00', end: '14:00' },
      ],
      sunday: [],
    },
  },
}

// 방학 중 평일만 운영 (방학 시 휴무)
const vacationClosedVenue = {
  id: 'vacation-closed',
  name: '방학휴무식당',
  building: '중앙도서관',
  floor: '1F',
  category: '한식',
  is24h: false,
  closedDays: ['saturday', 'sunday', 'holiday'],
  schedule: {
    semester: {
      weekday: [{ type: '운영', start: '09:00', end: '20:00' }],
      saturday: [],
      sunday: [],
    },
    vacation: {
      weekday: [],
      saturday: [],
      sunday: [],
    },
  },
}

// 24시간 venue (schedule 구조)
const always24hVenue = {
  id: 'gs25-test',
  name: 'GS25',
  building: 'TIP',
  floor: '1F',
  category: '편의점',
  is24h: true,
  closedDays: [],
  schedule: {
    semester: { weekday: [], saturday: [], sunday: [] },
    vacation: { weekday: [], saturday: [], sunday: [] },
  },
}

describe('isOpenNow — schedule 구조 (학기/방학 + 요일)', () => {
  // 2026-06-25(목)은 방학, 2026-05-14(목)은 학기
  // 2026-05-14는 목요일(평일)

  it('학기 중 평일 12:00 → 학기 중식 슬롯으로 open이에요', () => {
    // 2026-05-14 목요일 12:00 KST (학기)
    const now = kst(2026, 5, 14, 12, 0)
    const result = isOpenNow(scheduleVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart?.type).toBe('중식')
  })

  it('방학 중 평일 08:50 → 방학 조식(09:00) 전이므로 before_open이에요', () => {
    // 2026-06-25 목요일 08:50 KST (방학) — 방학 조식은 09:00 시작
    const now = kst(2026, 6, 25, 8, 50)
    const result = isOpenNow(scheduleVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('before_open')
  })

  it('학기 중 평일 08:50 → 학기 조식(08:30~09:20) 범위이므로 open이에요', () => {
    // 2026-05-14 목요일 08:50 KST (학기) — 학기 조식은 08:30 시작
    const now = kst(2026, 5, 14, 8, 50)
    const result = isOpenNow(scheduleVenue, now)
    expect(result.open).toBe(true)
    expect(result.currentPart?.type).toBe('조식')
  })

  it('is24h=true 장소는 방학 중에도 always 상태에요', () => {
    // 방학 중 평일
    const now = kst(2026, 6, 25, 3, 0)
    const result = isOpenNow(always24hVenue, now)
    expect(result.open).toBe(true)
    expect(result.status).toBe('always')
  })

  it('방학 중 평일 빈 슬롯 venue는 closed_day 또는 after_close이에요', () => {
    // 방학 중 평일 12:00 — vacationClosedVenue의 vacation.weekday=[] 이므로 영업 없음
    const now = kst(2026, 6, 25, 12, 0)
    const result = isOpenNow(vacationClosedVenue, now)
    expect(result.open).toBe(false)
  })

  it('학기 중 평일 12:00 — vacationClosedVenue는 open이에요', () => {
    // 학기 중 평일 12:00
    const now = kst(2026, 5, 14, 12, 0)
    const result = isOpenNow(vacationClosedVenue, now)
    expect(result.open).toBe(true)
  })

  it('일요일(closedDays 포함) → closed_day이에요', () => {
    // 2026-06-28 일요일
    const now = kst(2026, 6, 28, 12, 0)
    const result = isOpenNow(scheduleVenue, now)
    expect(result.open).toBe(false)
    expect(result.status).toBe('closed_day')
  })
})

// ────────────────────────────────────────────────────────────────────
// 신규: building/floor → location 헬퍼
// ────────────────────────────────────────────────────────────────────
import { getVenueLocation } from './venueOpen'

describe('getVenueLocation — building + floor → 표시 문자열', () => {
  it('TIP + B1 → "TIP B1"이에요', () => {
    expect(getVenueLocation('TIP', 'B1')).toBe('TIP B1')
  })

  it('TIP + 1F → "TIP 1F"이에요', () => {
    expect(getVenueLocation('TIP', '1F')).toBe('TIP 1F')
  })

  it('E동 + 1F → "E동 1F"이에요', () => {
    expect(getVenueLocation('E동', '1F')).toBe('E동 1F')
  })

  it('중앙도서관 + 2F → "중앙도서관 2F"이에요', () => {
    expect(getVenueLocation('중앙도서관', '2F')).toBe('중앙도서관 2F')
  })

  it('floor가 없으면 building만 반환해요', () => {
    expect(getVenueLocation('TIP', '')).toBe('TIP')
    expect(getVenueLocation('TIP', undefined)).toBe('TIP')
  })
})
