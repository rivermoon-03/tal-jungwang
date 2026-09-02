/**
 * arrivalTime.js — 도착 시간 표시 유틸.
 *
 * "초 → 표시 문자열" 규칙(임박 임계값·라운딩·60분 초과 절대시각 전환)은
 * utils/eta.js가 표준이다. 이 파일은 이미 여러 화면(BusArrivalCard,
 * NearestStopCard, SchedulePage, busArrivalRows 등)이 쓰는 공개 API
 * (IMMINENT_THRESHOLD_SEC / isImminent / imminentLabel / describeArrival /
 * formatArrival / formatArrivalFromTime / getFirstBusLabel) 시그니처를
 * 유지한 채, 내부 규칙만 eta.js에 위임한다.
 *
 * formatArrival(secondsLeft)
 *   secondsLeft: 지금부터 도착까지 남은 초 (백엔드 arrive_in_seconds 필드)
 *   반환값:
 *     - secondsLeft == null    → null  (표시 없음)
 *     - secondsLeft < 0        → "곧 출발"
 *     - 임박 임계 이하(eta.js) → "곧 도착"
 *     - 남은 시간 ≤ 60분      → "N분"
 *     - 남은 시간 > 60분      → "HH:MM" (절대 시각, KST)
 *
 * formatArrivalFromTime(departAtStr)
 *   departAtStr: "HH:MM" 또는 "HH:MM:SS" 형식의 출발 시각 문자열
 *   지금 시각과 비교하여 위와 동일한 규칙으로 반환.
 */
import { IMMINENT_THRESHOLD_SEC, isImminent, formatEta } from './eta'

export { IMMINENT_THRESHOLD_SEC, isImminent }

/**
 * mode에 따라 "곧 도착"(버스/지하철) 또는 "곧 출발"(셔틀) 반환.
 */
export function imminentLabel(mode = 'arrive') {
  return mode === 'depart' ? '곧 출발' : '곧 도착'
}

/**
 * 남은 초 → 대시보드/카드에서 쓰는 통합 설명 객체.
 * imminent일 땐 minutes=0으로 두고 label을 채워 컨슈머가 분기하기 쉽게 한다.
 */
export function describeArrival(seconds, { mode = 'arrive' } = {}) {
  if (seconds == null) return { imminent: false, minutes: null, label: null }
  if (isImminent(seconds)) {
    return { imminent: true, minutes: 0, label: imminentLabel(mode) }
  }
  const minutes = Math.max(1, Math.floor(seconds / 60))
  return { imminent: false, minutes, label: `${minutes}분` }
}

/**
 * 남은 초를 기반으로 도착 표시 문자열을 반환한다. 음수(이미 지남)만 이 함수
 * 고유의 "곧 출발" 라벨로 처리하고, 나머지는 eta.js formatEta에 위임한다.
 * @param {number|null} secondsLeft
 * @returns {string|null}
 */
export function formatArrival(secondsLeft) {
  if (secondsLeft == null) return null
  if (secondsLeft < 0) return '곧 출발'
  return formatEta(secondsLeft).text
}

/**
 * "HH:MM" 또는 "HH:MM:SS" 출발 시각 문자열을 현재 시각과 비교.
 * @param {string} departAtStr
 * @returns {string|null}
 */
export function formatArrivalFromTime(departAtStr) {
  if (!departAtStr) return null
  const now = new Date()
  const [hStr, mStr] = departAtStr.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return departAtStr

  const departDate = new Date(now)
  departDate.setHours(h, m, 0, 0)

  const diffSec = Math.floor((departDate.getTime() - now.getTime()) / 1000)

  // 이미 지났거나 12시간 초과이면 표시 안 함
  if (diffSec < 0 || diffSec > 12 * 60 * 60) return null

  if (diffSec <= 60 * 60) return formatEta(diffSec).text

  // 60분 초과 → 절대 시각은 입력 문자열에서 직접 추출 (Date.now() drift 방지 —
  // eta.js formatEta의 now+seconds 합산 대신 원본 HH:MM을 그대로 쓴다)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 막차가 끝난 경우 첫차까지의 정보를 반환하는 라벨 생성기
 * @param {string[]} allTimes - 모든 시간표 ("HH:MM" 리스트)
 * @param {Date} now - 현재 시각
 * @returns {string}
 */
export function getFirstBusLabel(allTimes, now = new Date()) {
  // 00:00~03:59 시간대는 전날 막차의 연장 운행이므로 "첫차" 기준에서 제외.
  // 04:00 이후 첫 번째 시간을 실질적인 첫차로 간주.
  const morningFirst = allTimes.find((t) => {
    const h = parseInt((t ?? '').split(':')[0], 10)
    return !Number.isNaN(h) && h >= 4
  })
  const firstStr = morningFirst ?? allTimes[0]
  if (!firstStr) return '·'
  const [fh, fm] = firstStr.split(':').map(Number)

  // 서비스 날짜 기준: 새벽 4시 이전은 아직 '어제'의 연장선으로 취급할 수 있음.
  // 하지만 첫차 라벨을 붙이는 시점은 보통 막차가 끊긴 이후임.
  const hour = now.getHours()
  const isEarlyMorning = hour < 4

  // '다음' 첫차의 날짜 결정
  const firstBusDate = new Date(now)
  if (!isEarlyMorning) {
    // 밤 늦은 시간 (4시~23시) -> '내일' 첫차
    firstBusDate.setDate(firstBusDate.getDate() + 1)
  }
  // 새벽 시간 (0시~4시) -> '오늘' 아침 첫차
  firstBusDate.setHours(fh, fm, 0, 0)

  const diffMin = Math.round((firstBusDate - now) / 60000)

  if (diffMin >= 0 && diffMin <= 100) {
    const h = Math.floor(diffMin / 60)
    const m = diffMin % 60
    return h > 0 ? `${h}시간 ${m}분 뒤에 첫차` : `${m}분 뒤에 첫차`
  }

  return isEarlyMorning ? `${firstStr}에 첫차` : `내일 ${firstStr}에 첫차`
}
