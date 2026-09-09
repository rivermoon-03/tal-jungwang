/**
 * favCode.js — 즐겨찾기 코드 문자열을 화면이 쓸 수 있는 형태로 푼다.
 *
 * 즐겨찾기는 문자열 하나로 저장되는데 형식이 두 세대다.
 *   신규(utils/favKey.js)  `bus:3:하교` · `shuttle:main:등교` · `subway:정왕:up`
 *   레거시                 `등교:3400` · `shuttle:2캠 하교` · `3400`
 * 화면에 따라 쓰는 배열이 달라(favorites.keys / favorites.routes) 둘 다 들어온다.
 *
 * 신규 스키마를 못 읽던 시절 시간표에서 누른 별은 독 팝오버와 PC 사이드바에서
 * 조용히 사라졌고(`bus:3:하교` → null → filter(Boolean) 에서 제거), 셔틀은
 * `셔틀main:등교` 라는 문자열이 그대로 화면에 찍혔다.
 *
 * 파싱을 여기로 올려 두 화면이 같은 결과를 쓰게 한다.
 */

const SHUTTLE_CAMPUS_TAG = { main: '', second: '2캠 ' }

function parseShuttleFav(favCode) {
  if (!favCode.startsWith('shuttle:')) return null
  const rest = favCode.slice(8)
  let campusTag
  let label
  if (rest.includes(':')) {
    // 신규 "shuttle:{main|second}:{등교|하교}"
    const [campus, dir] = rest.split(':')
    campusTag = SHUTTLE_CAMPUS_TAG[campus]
    label = dir
    if (campusTag === undefined || !label) return null
  } else {
    campusTag = rest.startsWith('2캠 ') ? '2캠 ' : ''
    label = rest.slice(campusTag.length)
  }
  if (!label) return null
  return {
    type: 'shuttle',
    routeCode: `${campusTag}셔틀${label}`,
    title: `${campusTag}셔틀버스 ${label}`,
    favCode,
  }
}

function parseBusFav(favCode) {
  // 신규 "bus:{id}:{category}" — id 는 route_id(숫자) 또는 route_number 다.
  const modern = favCode.match(/^bus:([^:]+):(등교|하교|기타)?$/)
  if (modern) {
    const [, id, category] = modern
    return {
      type: 'bus',
      routeCode: id,
      title: category ? `${id} (${category})` : id,
      favCode,
      category: category ?? null,
      routeId: /^\d+$/.test(id) ? Number(id) : null,
    }
  }
  const match = favCode.match(/^(등교|하교|기타):(.+)$/)
  if (match) {
    const [, category, routeNumber] = match
    return {
      type: 'bus',
      routeCode: routeNumber,
      title: `${routeNumber} (${category})`,
      favCode,
      category,
    }
  }
  // 가장 오래된 형태 — useFavorites 훅이 쓰던 순수 노선번호("3400", "시흥33").
  // 콜론이 없으면 이것뿐이다. 못 읽으면 사이드바와 팝오버에서 조용히 사라진다.
  if (!favCode.includes(':')) {
    return { type: 'bus', routeCode: favCode, title: favCode, favCode, category: null }
  }
  return null
}

function parseSubwayFav(favCode) {
  if (!favCode.startsWith('subway:')) return null
  const parts = favCode.split(':')
  const station = parts[1] ?? '정왕'
  const dir = parts[2] ?? 'up'
  const dirLabel = dir === 'up' ? '왕십리행' : dir === 'down' ? '인천행' : '행선지'
  return {
    type: 'subway',
    routeCode: `${station} (${dirLabel})`,
    title: `${station} ${dirLabel}`,
    favCode,
    station,
    dir,
  }
}

/**
 * 즐겨찾기 코드 → { type, routeCode, title, favCode, ... } · 해석 불가면 null.
 * @param {string} favCode
 */
export function parseFavCode(favCode) {
  if (typeof favCode !== 'string' || !favCode) return null
  if (favCode.startsWith('shuttle:')) return parseShuttleFav(favCode)
  if (favCode.startsWith('subway:')) return parseSubwayFav(favCode)
  return parseBusFav(favCode)
}
