/**
 * cafeteriaVenues.js — 한국공학대학교 교내 매점/식당 운영 정보 (16곳)
 *
 * venue shape (신형):
 *   {
 *     id:         string,                     // 영문 슬러그
 *     name:       string,
 *     building:   'TIP'|'E동'|'중앙도서관',
 *     floor:      'B1'|'1F'|'2F',
 *     category:   '한식'|'분식'|'중식'|'양식'|'패스트푸드'|'카페'|'편의점',
 *     is24h?:     boolean,
 *     closedDays: string[],                   // 'sunday'|'saturday'|...|'holiday'
 *     schedule:   {
 *       semester: { weekday, saturday, sunday },  // [{type,start,end}]
 *       vacation: { weekday, saturday, sunday },
 *     },
 *     menu?:      string[],
 *     note?:      string,
 *   }
 *
 * 하위 호환 필드 (CafeteriaVenues.jsx RestaurantCard / SimpleVenueCard가 사용):
 *   location:    string   — getVenueLocation(building, floor) 값
 *   catLabel:    string   — category 짧은 표시 라벨
 *   meals?:      [{type,start,end}]   — 학식 카드용 (학기 평일 슬롯)
 *   hours?:      [{start,end}]        — 단순 시간대 카드용 (학기 평일 슬롯)
 *   alwaysOpen?: boolean              — is24h 동의어
 */

// ── 헬퍼 ─────────────────────────────────────────────────────
/** building + floor → 표시 문자열 (ex. "TIP B1") */
function loc(building, floor) {
  return floor ? `${building} ${floor}` : building
}

// ── 학식 (한식) ───────────────────────────────────────────────
export const RESTAURANTS = [
  {
    id: 'student-cafeteria',
    name: '학생식당',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '한식',
    catLabel: '식당',
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
    // 하위 호환: 학기 평일 슬롯 노출
    meals: [
      { type: '조식', start: '08:30', end: '09:20' },
      { type: '중식', start: '11:00', end: '14:00' },
      { type: '석식', start: '17:00', end: '18:50' },
    ],
    menu: ['천원의아침밥', '셀프라면', '매일 바뀌는 식단'],
    note: '천원의 아침밥',
    closedNote: '일요일 휴무',
  },
  {
    id: 'e-restaurant',
    name: 'E동레스토랑',
    building: 'E동',
    floor: '1F',
    location: loc('E동', '1F'),
    category: '한식',
    catLabel: '식당',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [
          { type: '중식', start: '11:30', end: '13:50' },
          { type: '석식', start: '16:50', end: '18:40' },
        ],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [
          { type: '중식', start: '11:30', end: '13:50' },
        ],
        saturday: [],
        sunday: [],
      },
    },
    meals: [
      { type: '중식', start: '11:30', end: '13:50' },
      { type: '석식', start: '16:50', end: '18:40' },
    ],
    menu: ['매일 바뀌는 한식식단'],
    closedNote: '주말·공휴일 휴무',
  },
]

// ── 푸드코트 & 기타 식당 ──────────────────────────────────────
export const FOOD_COURT = [
  {
    id: 'raon-restaurant',
    name: '라온식당',
    building: '중앙도서관',
    floor: '1F',
    location: loc('중앙도서관', '1F'),
    category: '한식',
    catLabel: '한식',
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
    hours: [{ start: '09:00', end: '20:00' }],
    menu: ['찌개', '덮밥', '분식', '주먹밥'],
    closedNote: '주말·공휴일·방학 휴무',
  },
  {
    id: 'suho-restaurant',
    name: '수호식당',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '한식',
    catLabel: '한식',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '10:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '10:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '10:00', end: '20:00' }],
    menu: ['한식뷔페', '국밥', '순대국', '칼국수', '맥주'],
    note: '한식뷔페',
    closedNote: '주말·공휴일 휴무',
  },
  {
    id: 'tomato-gimbap',
    name: '토마토김밥',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '분식',
    catLabel: '분식',
    closedDays: [],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        // 격주 운영 — 주말은 불규칙하므로 평일만 확정
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '11:00', end: '19:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '11:00', end: '20:00' }],
    menu: ['김밥', '라면', '떡볶이'],
    note: '격주 운영',
    closedNote: '주말격주',
  },
  {
    id: 'new-beijing',
    name: '신북경',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '중식',
    catLabel: '중식',
    closedDays: ['saturday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        saturday: [],
        sunday: [{ type: '운영', start: '11:00', end: '20:00' }],
      },
      vacation: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        saturday: [],
        sunday: [{ type: '운영', start: '11:00', end: '20:00' }],
      },
    },
    hours: [{ start: '11:00', end: '20:00' }],
    menu: ['짜장', '짬뽕', '볶음밥', '덮밥', '탕수육'],
    closedNote: '토요일 휴무',
  },
  {
    id: 'beijing-malatang',
    name: '북경마라탕',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '중식',
    catLabel: '중식',
    closedDays: ['saturday', 'sunday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '11:00', end: '20:00' }],
    menu: ['마라탕', '마라상궈', '꿔버로우'],
    closedNote: '학기 중 평일만 운영',
  },
  {
    id: 'hans-omelette',
    name: '한스오믈렛',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '양식',
    catLabel: '양식',
    closedDays: [],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '11:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '11:00', end: '20:00' }],
    menu: ['오믈렛', '볶음밥', '덮밥류'],
    note: '격주 운영',
    closedNote: '주말격주',
  },
  {
    id: 'olive-green',
    name: '올리브그린',
    building: 'TIP',
    floor: '2F',
    location: loc('TIP', '2F'),
    category: '양식',
    catLabel: '양식',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '10:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '10:00', end: '14:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '10:00', end: '20:00' }],
    menu: ['돈까스', '볶음밥', '호프'],
    closedNote: '주말·공휴일 휴무',
  },
  {
    id: 'momsters',
    name: '맘스터치',
    building: 'TIP',
    floor: 'B1',
    location: loc('TIP', 'B1'),
    category: '패스트푸드',
    catLabel: '버거',
    closedDays: [],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '10:30', end: '21:00' }],
        saturday: [{ type: '운영', start: '10:30', end: '21:00' }],
        sunday: [{ type: '운영', start: '11:00', end: '21:00' }],
      },
      vacation: {
        weekday: [{ type: '운영', start: '10:30', end: '21:00' }],
        saturday: [{ type: '운영', start: '10:30', end: '21:00' }],
        sunday: [{ type: '운영', start: '11:00', end: '21:00' }],
      },
    },
    hours: [{ start: '10:30', end: '21:00' }],
    closedNote: '연중무휴',
  },
  {
    id: 'vertex',
    name: '버텍스(VERTEX)',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '패스트푸드',
    catLabel: '패스트푸드',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '10:00', end: '22:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '10:00', end: '22:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '10:00', end: '22:00' }],
    closedNote: '주말·공휴일 휴무',
  },
]

// ── 카페 ─────────────────────────────────────────────────────
export const CAFES = [
  {
    id: 'cafe-ing',
    name: '카페아이엔지',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '카페',
    catLabel: '카페',
    closedDays: [],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '08:30', end: '20:30' }],
        saturday: [{ type: '운영', start: '12:00', end: '18:00' }],
        sunday: [{ type: '운영', start: '12:00', end: '18:00' }],
      },
      vacation: {
        weekday: [{ type: '운영', start: '08:30', end: '20:30' }],
        saturday: [{ type: '운영', start: '12:00', end: '18:00' }],
        sunday: [{ type: '운영', start: '12:00', end: '18:00' }],
      },
    },
    hours: [{ start: '08:30', end: '20:30' }],
    menu: ['베이커리', '디저트', '커피'],
    note: '베이커리',
  },
  {
    id: 'cafe-tospia',
    name: '카페토스피아',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '카페',
    catLabel: '카페',
    closedDays: ['sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '08:00', end: '20:00' }],
        saturday: [{ type: '운영', start: '10:00', end: '15:00' }],
        sunday: [],
      },
      vacation: {
        weekday: [{ type: '운영', start: '10:00', end: '19:00' }],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '08:00', end: '20:00' }],
    menu: ['샌드위치', '커피'],
    closedNote: '일·공휴일 휴무',
  },
  {
    id: 'coffee-bay',
    name: '커피베이',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '카페',
    catLabel: '카페',
    closedDays: ['holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '09:00', end: '20:00' }],
        saturday: [{ type: '운영', start: '09:00', end: '20:00' }],
        sunday: [{ type: '운영', start: '09:00', end: '20:00' }],
      },
      vacation: {
        weekday: [{ type: '운영', start: '09:00', end: '18:30' }],
        saturday: [{ type: '운영', start: '09:00', end: '18:30' }],
        sunday: [{ type: '운영', start: '09:00', end: '18:30' }],
      },
    },
    hours: [{ start: '09:00', end: '20:00' }],
    menu: ['커피'],
    closedNote: '공휴일 휴무',
  },
  {
    id: 'study-store',
    name: '스터디매점',
    building: '중앙도서관',
    floor: '2F',
    location: loc('중앙도서관', '2F'),
    category: '카페',
    catLabel: '매점',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '10:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '10:00', end: '20:00' }],
    closedNote: '주말·공휴일·방학 휴무',
  },
  {
    id: 'tuk-store',
    name: 'TUK STORE',
    building: '중앙도서관',
    floor: '1F',
    location: loc('중앙도서관', '1F'),
    category: '카페',
    catLabel: '베이커리',
    closedDays: ['saturday', 'sunday', 'holiday'],
    schedule: {
      semester: {
        weekday: [{ type: '운영', start: '08:00', end: '20:00' }],
        saturday: [],
        sunday: [],
      },
      vacation: {
        weekday: [],
        saturday: [],
        sunday: [],
      },
    },
    hours: [{ start: '08:00', end: '20:00' }],
    menu: ['베이커리'],
    closedNote: '주말·공휴일·방학 휴무',
  },
]

// ── 편의점 ───────────────────────────────────────────────────
export const CONVENIENCE = [
  {
    id: 'gs25',
    name: 'GS25',
    building: 'TIP',
    floor: '1F',
    location: loc('TIP', '1F'),
    category: '편의점',
    catLabel: '편의점',
    is24h: true,
    alwaysOpen: true,
    closedDays: [],
    schedule: {
      semester: { weekday: [], saturday: [], sunday: [] },
      vacation: { weekday: [], saturday: [], sunday: [] },
    },
    closedNote: '연중무휴',
  },
]

// ── 기존 OTHERS (하위 호환 re-export) ─────────────────────────
// CafeteriaVenues.jsx의 VENUE_GROUPS이 이전에 '기타' 키를 사용했으나
// 현재는 FOOD_COURT에 통합. 빈 배열로 선언해 import 오류 방지.
export const OTHERS = []

// ── 전체 flat 배열 (카테고리 순) ─────────────────────────────
export const ALL_VENUES = [
  ...RESTAURANTS,
  ...FOOD_COURT,
  ...CAFES,
  ...CONVENIENCE,
]

// ── 카테고리별 그룹 (순서 보장) ──────────────────────────────
export const VENUE_GROUPS = [
  { key: '학식',    label: '학식',    venues: RESTAURANTS },
  { key: '푸드코트', label: '푸드코트 & 식당', venues: FOOD_COURT },
  { key: '카페',    label: '카페 & 매점', venues: CAFES },
  { key: '편의점',  label: '편의점',  venues: CONVENIENCE },
]

// ── 건물별 그룹 (순서 보장: TIP → E동 → 중앙도서관) ──────────────
export const BUILDING_ORDER = ['TIP', 'E동', '중앙도서관']

export const BUILDING_GROUPS = BUILDING_ORDER.map((building) => ({
  key: building,
  label: building,
  venues: ALL_VENUES.filter((v) => v.building === building),
})).filter((g) => g.venues.length > 0)

// ── 카테고리별 상세 그룹 (정렬 기준용, 순서 보장) ────────────────
export const CATEGORY_ORDER = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']

export const CATEGORY_GROUPS = CATEGORY_ORDER.map((cat) => ({
  key: cat,
  label: cat,
  venues: ALL_VENUES.filter((v) => v.category === cat),
})).filter((g) => g.venues.length > 0)
