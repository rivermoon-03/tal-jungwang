/**
 * sunPosition.js — 정왕동 기준 태양 고도 계산.
 *
 * 왜 필요한가: 히어로 배경이 낮/저녁/밤 세 칸(getTimeOfDay)으로만 갈리면
 * 12월 6시와 6월 6시가 같은 하늘이 된다. 실제 하늘은 시계가 아니라 태양
 * 고도가 결정하므로, 고도를 직접 구해 배경을 연속으로 만든다.
 *
 * 알고리즘은 천문 표준식(J2000 기준 태양 황경 → 적위 → 시간각 → 고도)이다.
 * 라이브러리(suncalc 등)를 넣지 않은 이유: 이 앱의 런타임 의존성은 6개뿐이고
 * 필요한 건 고도 하나뿐이라, 아래 40줄이 패키지 하나보다 짧고 테스트하기 쉽다.
 *
 * 시간대 주의: Date.getTime()은 epoch 기준이라 타임존과 무관하다. 따라서 이
 * 계산에는 KST 변환이 필요 없다(CLAUDE.md의 tz 철칙은 "로컬 시각을 읽을 때"의
 * 이야기다 — 여기서는 애초에 로컬 시각을 읽지 않는다). 대신 관측지 경도를
 * 고정값으로 넣어 지역성을 준다.
 */

const RAD = Math.PI / 180

// 한국공학대 정왕캠퍼스(경기 시흥시 정왕동) 좌표.
export const JEONGWANG = { lat: 37.3405, lon: 126.7335 }

// 지구 자전축 기울기(황도경사).
const OBLIQUITY = RAD * 23.4397

/** epoch ms → J2000 기준 경과일수. */
function daysSinceJ2000(date) {
  return date.getTime() / 86400000 - 10957.5
}

/** 태양 평균근점이각. */
function solarMeanAnomaly(d) {
  return RAD * (357.5291 + 0.98560028 * d)
}

/** 태양 황경(중심차 보정 + 근일점 경도 + 180°). */
function eclipticLongitude(m) {
  // 중심차(equation of center) 3차항까지.
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m))
  const perihelion = RAD * 102.9372
  return m + c + perihelion + Math.PI
}

/**
 * 주어진 시각의 태양 고도(지평선 위 각도, degree)를 구한다.
 * 음수면 해가 진 상태다. 지평선 근처 대기굴절 보정은 하지 않는다
 * (배경 색을 정하는 용도라 0.5도 수준의 오차는 무의미하다).
 *
 * @param {Date} date
 * @param {{lat: number, lon: number}} at 관측지 좌표
 * @returns {number} 고도(degree, 약 -90 ~ +90)
 */
export function getSunAltitude(date = new Date(), at = JEONGWANG) {
  const d = daysSinceJ2000(date)
  const m = solarMeanAnomaly(d)
  const lambda = eclipticLongitude(m)

  // 적위 · 적경
  const declination = Math.asin(Math.sin(OBLIQUITY) * Math.sin(lambda))
  const rightAscension = Math.atan2(
    Math.sin(lambda) * Math.cos(OBLIQUITY),
    Math.cos(lambda),
  )

  // 시간각 = 그리니치 항성시 - 서경 - 적경
  const westLon = RAD * -at.lon
  const siderealTime = RAD * (280.16 + 360.9856235 * d) - westLon
  const hourAngle = siderealTime - rightAscension

  const phi = RAD * at.lat
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
  )
  return altitude / RAD
}

/**
 * 태양이 하루 궤도의 어디쯤인지를 0~1로 돌려준다(0=자정 근처, 0.5=정오 근처).
 * 해/달 아이콘을 히어로 가로축 어디에 놓을지 정하는 데만 쓴다 — 방위각을
 * 정식으로 구하는 대신, 시간각을 그대로 정규화해 쓴다(동→서 진행이 같다).
 *
 * @param {Date} date
 * @param {{lat: number, lon: number}} at
 * @returns {number} 0~1
 */
export function getSunDayProgress(date = new Date(), at = JEONGWANG) {
  const d = daysSinceJ2000(date)
  const m = solarMeanAnomaly(d)
  const lambda = eclipticLongitude(m)
  const rightAscension = Math.atan2(
    Math.sin(lambda) * Math.cos(OBLIQUITY),
    Math.cos(lambda),
  )
  const westLon = RAD * -at.lon
  const siderealTime = RAD * (280.16 + 360.9856235 * d) - westLon
  let hourAngle = (siderealTime - rightAscension) / RAD
  // 시간각을 -180~180으로 접는다. -180=자정, 0=남중(정오), +180=자정.
  hourAngle = ((hourAngle % 360) + 540) % 360 - 180
  return (hourAngle + 180) / 360
}

/**
 * 고도를 기존 CSS가 쓰던 세 칸(data-time)으로 환산한다.
 * 배경 색 자체는 고도로 연속 보간하지만, 구름 틴트나 번개처럼 "밤이냐"만
 * 알면 되는 규칙은 이 값으로 계속 분기한다.
 *
 * @param {number} altitudeDeg
 * @returns {'day'|'evening'|'night'}
 */
export function getSunPhase(altitudeDeg) {
  if (altitudeDeg < -6) return 'night'   // 시민박명보다 어두움
  if (altitudeDeg < 8) return 'evening'  // 박명 ~ 낮은 해(골든아워)
  return 'day'
}
