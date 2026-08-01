/**
 * favKey — 즐겨찾기 키 스키마 단일화
 *
 * 배경: 기존에는 화면마다 즐겨찾기 저장 형식이 달랐다.
 *  - useFavorites 훅(BusArrivalCard/SubwayRealtimeCard/RouteDetailPage)은
 *    순수 노선번호("20-1")를 그대로 저장.
 *  - SchedulePage의 "즐겨찾기만" 필터(BusGroupContent 등)는
 *    "${busGroup}:${route_number}"("하교:20-1") 형태의 favCode로 비교.
 *  → 같은 노선을 즐겨찾기해도 형식이 어긋나 필터가 영원히 비는 버그가 있었다.
 *
 * 이 모듈이 앞으로의 신규 저장 스키마 단일 출처다. 레거시 저장값(순수 노선번호,
 * "${busGroup}:${routeNo}")과의 런타임 호환은 matchesLegacy가 담당하므로,
 * 기존 favorites.routes 배열을 즉시 일괄 변환할 필요는 없다.
 *
 * 신규 스키마: "${mode}:${id}:${direction}"
 *   mode      'bus' | 'subway' | 'shuttle' — 항상 소문자로 정규화.
 *   id        노선번호 / 역 코드 / 캠퍼스 코드 등 모드별 식별자. 원문 그대로 보존
 *             (대소문자·표기는 호출자 책임 — 이 모듈은 앞뒤 공백만 다듬는다).
 *   direction '등교' | '하교' | 'up' | 'down' 등 모드별 관용 표기. 생략 시 빈 문자열
 *             ("")로 채워 세 세그먼트 형태(콜론 2개)를 항상 유지한다.
 *
 * 예시:
 *   makeFavKey({mode:'bus', id:'3', direction:'하교'})     → "bus:3:하교"
 *   makeFavKey({mode:'subway', id:'suin', direction:'up'}) → "subway:suin:up"
 *   makeFavKey({mode:'shuttle', id:'main', direction:'등교'}) → "shuttle:main:등교"
 *   makeFavKey({mode:'bus', id:'20-1'})                    → "bus:20-1:" (direction 생략)
 */

/**
 * @param {{mode: string, id: string|number, direction?: string|null}} params
 * @returns {string}
 */
export function makeFavKey({ mode, id, direction } = {}) {
  const normMode = String(mode ?? '').trim().toLowerCase()
  const normId = String(id ?? '').trim()
  const normDirection = direction == null ? '' : String(direction).trim()
  return `${normMode}:${normId}:${normDirection}`
}

/**
 * makeFavKey의 역함수. 세 세그먼트(mode/id/direction) 미만이면(콜론 부족) 구버전
 * 키일 가능성이 높다고 보고 null을 돌려준다 — 레거시 판정은 matchesLegacy 몫이다.
 * direction이 빈 문자열이면 null로 정규화한다(생략과 동일 취급).
 *
 * @param {string} key
 * @returns {{mode: string, id: string, direction: string|null} | null}
 */
export function parseFavKey(key) {
  if (typeof key !== 'string' || key === '') return null
  const parts = key.split(':')
  if (parts.length < 3) return null
  const [mode, id, ...rest] = parts
  if (!mode || !id) return null
  const direction = rest.join(':')
  return { mode, id, direction: direction === '' ? null : direction }
}

/**
 * matchesLegacy — 구버전 저장값과 신규 favKey를 모두 검사하는 즐겨찾기 매칭 헬퍼.
 *
 * 레거시 형태(하위호환 대상, FavoritesPage.jsx의 ROUTE_STATION_MAP/parseBusFavKey
 * 참고):
 *  - 순수 노선번호            예) "20-1", "시흥33"
 *  - "${busGroup}:${routeNo}" 예) "하교:20-1", "버스 - 서울행:3400"
 *
 * routeNumber는 위 두 레거시 형태를 검사하는 데 쓰이고, favKey는 신규 스키마
 * (makeFavKey 결과)를 정확히 대조하는 데 쓰인다. 둘 중 하나라도 favList에
 * 있으면 즐겨찾기된 것으로 본다.
 *
 * @param {string[]} favList              favorites.routes 등 저장된 배열
 * @param {{routeNumber?: string, favKey?: string}} match
 * @returns {boolean}
 */
export function matchesLegacy(favList, { routeNumber, favKey } = {}) {
  if (!Array.isArray(favList) || favList.length === 0) return false

  if (favKey && favList.includes(favKey)) return true

  if (routeNumber == null || routeNumber === '') return false
  const target = String(routeNumber)
  return favList.some((entry) => {
    if (typeof entry !== 'string') return false
    if (entry === target) return true
    // "${busGroup}:${routeNo}" 형태 — 마지막 세그먼트가 노선번호와 일치하면 매칭.
    // busGroup 자체(등교/하교/기타/"버스 - 서울행" 등)의 정확한 값을 몰라도
    // 되도록 접두사 무관하게 "콜론 뒤 마지막 조각"만 비교한다.
    const idx = entry.lastIndexOf(':')
    if (idx === -1) return false
    return entry.slice(idx + 1) === target
  })
}
