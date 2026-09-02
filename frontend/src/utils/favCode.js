/**
 * favCode.js — 즐겨찾기 코드 문자열을 화면이 쓸 수 있는 형태로 푼다.
 *
 * 즐겨찾기는 `등교:3400` / `subway:정왕:up` / `shuttle:2캠 하교` 같은 문자열 하나로
 * 저장된다(useAppStore.favorites.routes). 이걸 푸는 코드가 팝오버 안에만 있어서
 * PC 사이드바는 같은 목록을 띄워 놓고도 항목을 열 수단이 없었다 — 그래서 모든 행이
 * 설정 페이지로 가는 오배선이 남아 있었다. 파싱을 여기로 올려 두 화면이 같은
 * 결과를 쓰게 한다.
 */

function parseShuttleFav(favCode) {
  if (!favCode.startsWith('shuttle:')) return null
  const rest = favCode.slice(8)
  const isCampus2 = rest.startsWith('2캠 ')
  const campusTag = isCampus2 ? '2캠 ' : ''
  const label = rest.slice(campusTag.length)
  return {
    type: 'shuttle',
    routeCode: `${campusTag}셔틀${label}`,
    title: `${campusTag}셔틀버스 ${label}`,
    favCode,
  }
}

function parseBusFav(favCode) {
  const match = favCode.match(/^(등교|하교|기타):(.+)$/)
  if (!match) return null
  const [, category, routeNumber] = match
  return {
    type: 'bus',
    routeCode: routeNumber,
    title: `${routeNumber} (${category})`,
    favCode,
    category,
  }
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
