/**
 * cafeteriaMenuVenue.js — 학식 메뉴 API 식당명 ↔ 정적 venue 데이터 매핑 + 운영상태
 *
 * 배경: 메뉴 API(`GET /cafeteria/menu`)는 `cafeterias[].name`으로 식당명을
 * 문자열로만 내려준다(백엔드 backend/app/services/cafeteria.py `_parse_xlsx`
 * 참조 — 실측 값은 "TIP 학생식당" / "E동 레스토랑" 고정 2종). 이 문자열을
 * `data/cafeteriaVenues.js`의 정적 venue(id/location/schedule)와 이어 붙여
 * PC 좌측 rail에서 위치·운영상태를 함께 보여주기 위한 순수 헬퍼.
 *
 * 영업 상태 판정은 절대 여기서 재구현하지 않는다 — `utils/venueOpen.js`의
 * tz-aware(Asia/Seoul) `isOpenNow`를 그대로 재사용한다. 문자열 시각 비교
 * ("11:00" <= ...) 금지 규칙은 venueOpen.js 안에서만 지켜지면 되고, 이 파일은
 * 그 결과를 그대로 통과시킨다.
 */
import { ALL_VENUES } from '../data/cafeteriaVenues'
import { isOpenNow, isVacationPeriod } from './venueOpen'

// ── 별칭 테이블 (실측: 메뉴 API cafeterias[].name → venue id) ────────────
// 백엔드가 xlsx에서 뽑아내는 식당명은 고정 리터럴이다(정규식 매치 후 하드코딩
// 된 이름을 그대로 반환). 아래 두 값이 현재 실제로 관측되는 전부다.
const CAFETERIA_NAME_ALIASES = {
  'TIP 학생식당': 'student-cafeteria',
  'E동 레스토랑': 'e-restaurant',
}

/**
 * 이름 비교용 정규화 — 공백 제거 + 건물 접두어(TIP/E동/중앙도서관) 제거.
 * 별칭 테이블에 없는 변형(예: 공백 유무, "TIP " 접두어 유무)을 흡수한다.
 * 시간 비교가 아닌 단순 텍스트 정규화이므로 tz 이슈와 무관하다.
 *
 * @param {string} name
 * @returns {string}
 */
function normalizeName(name) {
  if (typeof name !== 'string') return ''
  return name.replace(/\s+/g, '').replace(/^(TIP|E동|중앙도서관)/, '')
}

/**
 * 메뉴 API 식당명 → 정적 venue 객체.
 * 1) 별칭 테이블 우선 매칭
 * 2) 정규화(공백/건물접두어 제거) 후 venue.name과 매칭
 * 매핑 실패 시 예외를 던지지 않고 null을 반환한다.
 *
 * @param {string} cafeteriaName
 * @returns {object|null} data/cafeteriaVenues.js의 venue 객체 또는 null
 */
export function resolveVenueForCafeteria(cafeteriaName) {
  if (typeof cafeteriaName !== 'string' || !cafeteriaName.trim()) return null

  const aliasId = CAFETERIA_NAME_ALIASES[cafeteriaName]
  if (aliasId) {
    const aliased = ALL_VENUES.find((v) => v.id === aliasId)
    if (aliased) return aliased
  }

  const normalizedInput = normalizeName(cafeteriaName)
  if (!normalizedInput) return null

  return ALL_VENUES.find((v) => normalizeName(v.name) === normalizedInput) ?? null
}

/**
 * venue.schedule에서 "오늘"(KST 요일 + 학기/방학 여부)에 해당하는 슬롯 배열을
 * 뽑는다. isOpenNow와 같은 학기/방학·요일 판정 규칙을 쓰되, 시각 비교는 전혀
 * 하지 않는다(표시용 슬롯 나열일 뿐 — 열림/닫힘 판정은 isOpenNow가 전담).
 *
 * @param {object} venue
 * @param {Date} now
 * @returns {{ type?: string, start: string, end: string }[]}
 */
function resolveTodaySlots(venue, now) {
  if (!venue.schedule) return venue.meals ?? venue.hours ?? []

  const period = isVacationPeriod(now) ? 'vacation' : 'semester'
  const periodSchedule = venue.schedule[period]
  if (!periodSchedule) return []

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    weekday: 'long',
  }).format(now).toLowerCase()

  if (weekday === 'sunday') return periodSchedule.sunday ?? []
  if (weekday === 'saturday') return periodSchedule.saturday ?? []
  return periodSchedule.weekday ?? []
}

/**
 * 슬롯 배열 → "11:00 ~ 14:00, 17:00 ~ 18:50" 형태 문자열. 빈 배열이면 null.
 *
 * @param {{ start: string, end: string }[]} slots
 * @returns {string|null}
 */
function formatSlotsLabel(slots) {
  if (!Array.isArray(slots) || slots.length === 0) return null
  return slots.map((s) => `${s.start} ~ ${s.end}`).join(', ')
}

/**
 * 메뉴 API 식당명 → { status, primaryLabel, location, timeLabel }.
 * venue 매핑에 실패하거나 예상치 못한 오류가 나도 throw하지 않고
 * status: 'unknown'으로 graceful 폴백한다.
 *
 * @param {string} cafeteriaName
 * @param {Date} [nowDate] — 기본값 new Date()
 * @returns {{
 *   status: 'open'|'closing'|'before_open'|'after_close'|'closed_day'|'always'|'unknown',
 *   primaryLabel: string,
 *   location: string|null,
 *   timeLabel: string|null,
 * }}
 */
export function getCafeteriaStatus(cafeteriaName, nowDate = new Date()) {
  try {
    const venue = resolveVenueForCafeteria(cafeteriaName)
    if (!venue) {
      return { status: 'unknown', primaryLabel: '정보 없음', location: null, timeLabel: null }
    }

    const { status, primaryLabel } = isOpenNow(venue, nowDate)
    const timeLabel = (venue.alwaysOpen || venue.is24h)
      ? '24시간'
      : formatSlotsLabel(resolveTodaySlots(venue, nowDate))

    return { status, primaryLabel, location: venue.location ?? null, timeLabel }
  } catch {
    return { status: 'unknown', primaryLabel: '정보 없음', location: null, timeLabel: null }
  }
}

/**
 * 메뉴 API 식당명 + 끼니 타입("조식"/"중식"/"석식")이 지금(KST) 영업 중인지 판정.
 * venue.schedule에서 오늘(요일 + 학기/방학)에 해당하는 슬롯 중 type이 일치하는
 * 슬롯을 찾아 `isOpenNow`에 그대로 위임한다 — 메뉴 API가 내려주는
 * "11:30 ~ 13:30" 같은 표시용 시각 문자열을 직접 파싱해 비교하지 않는다.
 * venue 매핑 실패, 슬롯 없음, 예외 등은 모두 false로 graceful 폴백한다.
 *
 * @param {string} cafeteriaName
 * @param {string} mealType
 * @param {Date} [nowDate] — 기본값 new Date()
 * @returns {boolean}
 */
export function isMealTypeOpenNow(cafeteriaName, mealType, nowDate = new Date()) {
  try {
    const venue = resolveVenueForCafeteria(cafeteriaName)
    if (!venue || !mealType) return false

    const slot = resolveTodaySlots(venue, nowDate).find((s) => s.type === mealType)
    if (!slot) return false

    return isOpenNow({ meals: [slot], closedDays: [] }, nowDate).open
  } catch {
    return false
  }
}
