// 정류장별 허용 방향(등교/하교)·기본 방향·포함 노선·GBIS 실시간 정류장 ID 매핑.
// BusPanel/StationPills가 이 상수를 기준으로 pill·방향 탭·필터를 구성한다.

export const BUS_STATION_LABELS = ['한국공학대', '시화터미널', '이마트', '시흥시청', '서울']

// pill/배지 등 UI 표시용 축약명. 내부 id('한국공학대')는 persist 호환을 위해 유지하고 표시만 '본캠'으로 매핑한다.
export const BUS_STATION_DISPLAY = {
  '한국공학대': '본캠',
}

export function getBusStationDisplay(id) {
  return BUS_STATION_DISPLAY[id] ?? id
}

export const BUS_DIRECTION_LABELS = ['등교', '하교']

export const BUS_STATIONS = {
  한국공학대: {
    gbisStationId: '224000639',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    perRouteDisplay: {
      '11-A':   { origin: '한국공대', dest: '정왕역 경유' },
      '20-1':   { origin: '한국공대', dest: '정왕역 경유' },
      '시흥33': { origin: '한국공대', dest: '정왕역 경유 시흥시청행' },
    },
  },
  시화터미널: {
    gbisStationId: '224000861',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    perRouteDisplay: {
      '3400': { origin: '시화터미널', dest: '사당 경유 강남행' },
      '99-2': { origin: '시화터미널', dest: '이마트 경유 월곶역행' },
      '5200': { origin: '시화터미널', dest: '신천역 경유 신도림행' },
    },
  },
  이마트: {
    gbisStationId: '224000513',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    perRouteDisplay: {
      '3400':  { origin: '이마트', dest: '사당 경유 강남행' },
      '6502':  { origin: '이마트', dest: '사당행' },
      '시흥1': { origin: '이마트', dest: '신천역 경유 개봉행' },
      '3401':  { origin: '이마트', dest: '시흥시청·광명 경유 석수행' },
      '5602':  { origin: '이마트', dest: '시흥시청 경유 구로행' },
      '99-2':  { origin: '이마트', dest: '월곶역 방면' },
      '5200':  { origin: '이마트', dest: '신천역 경유 신도림행' },
    },
  },
  시흥시청: {
    gbisStationId: '224000586',
    allowedDirections: ['등교'],
    defaultDirection: '등교',
    perRouteDisplay: {
      '시흥33': { origin: '시흥시청역', dest: '학교행' },
      '3401':   { origin: '시흥시청역', dest: '이마트 경유 학교행' },
      '5602':   { origin: '시흥시청역', dest: '이마트 경유 학교행' },
    },
  },
  // 서울 출발 등교 전용 — 실시간 없음(시간표 기반)
  서울: {
    gbisStationId: null,
    allowedDirections: ['등교'],
    defaultDirection: '등교',
    perRouteDisplay: {
      '5602': { origin: '구로디지털', dest: '이마트 경유 학교행' },
      '6502': { origin: '사당역',     dest: '학교행' },
      '3400': { origin: '강남역',     dest: '학교행' },
      '3401': { origin: '석수역',     dest: '이마트 경유 학교행' },
    },
    routes: {
      등교: ['5602', '6502', '3400', '3401'],
    },
  },
}

export function getRouteCardDisplay(routeNo, category) {
  const p = getRoutePath(routeNo, category)
  if (!p) return null
  const via = p.waypoints.length ? `${p.waypoints.join(' 경유 ')} 경유 ` : ''
  const destTail = p.label.endsWith('행') || p.label.endsWith('방면') ? p.label : `${p.label}행`
  return { origin: p.origin, dest: `${via}${destTail}` }
}

export function getAllowedDirections(station) {
  return BUS_STATIONS[station]?.allowedDirections ?? ['하교']
}

export function getDefaultDirection(station) {
  return BUS_STATIONS[station]?.defaultDirection ?? '하교'
}

// 서울 정류장만 whitelist 방식으로 노선을 제한한다.
// gbis 정류장(한국공학대/이마트/시흥시청)은 arrivals API에서 모든 노선을 반환하므로 사용하지 않음.
export function getRoutesFor(station, direction) {
  return BUS_STATIONS[station]?.routes?.[direction] ?? []
}

export function getGbisStationId(station) {
  return BUS_STATIONS[station]?.gbisStationId ?? null
}

export function getViaLabel(station, direction) {
  return BUS_STATIONS[station]?.viaLabel?.[direction] ?? null
}

export function getPerRouteDisplay(station) {
  return BUS_STATIONS[station]?.perRouteDisplay ?? null
}

// 노선별 표시 색상 + 방향 레이블 (단일 소스)
// BusPanel과 MarkerSheet 양쪽에서 동일하게 사용
export const ROUTE_DISPLAY_CONFIG = {
  '3400':  { color: '#DC2626', category: 'express', direction: '사당 경유 · 강남행' },
  '5200':  { color: '#DC2626', category: 'express', direction: '신천역 경유 · 신도림행' },
  '6502':  { color: '#DC2626', category: 'express', direction: '사당행' },
  '3401':  { color: '#DC2626', category: 'express', direction: '시흥시청·광명 경유 · 석수행' },
  '5602':  { color: '#2563EB', category: 'trunk',   direction: '시흥시청 경유 · 구로행' },
  '시흥33': { color: '#0891B2', category: 'local',   direction: null },
  '20-1':  { color: '#2563EB', category: 'trunk',   direction: null },
  '11-A':  { color: '#0891B2', category: 'local',   direction: null },
  '99-2':  { color: '#0891B2', category: 'local',   direction: null },
  '시흥1':  { color: '#0891B2', category: 'local',   direction: null },
}

export function getRouteDisplayConfig(routeNo) {
  return ROUTE_DISPLAY_CONFIG[routeNo] ?? null
}

/**
 * 정류장 카드의 출발지/탑승 라벨을 방향에 따라 분기한다.
 *
 * - 하교: "○○ 출발" — 이 정류장이 실제 출발지
 * - 등교: "○○에서 타요" — 이 정류장은 경유 탑승지, "출발"로 오해되면 안 됨
 *
 * @param {string} station  선택된 정류장 ID (busStationConfig 키)
 * @param {string} direction '등교' | '하교'
 * @param {string} originName perRouteDisplay.origin 값 (호출처에서 전달)
 * @returns {string}
 */
export function getOriginLabel(station, direction, originName) {
  if (!originName) return ''
  if (direction === '등교') {
    return `${originName} 탑승`
  }
  return `${originName} 출발`
}

export const ROUTE_CATEGORY_ORDER = ['express', 'trunk', 'local']
export const ROUTE_CATEGORY_LABEL = {
  express: '광역버스',
  trunk:   '간선버스',
  local:   '시내·마을',
}
export const ROUTE_CATEGORY_SWATCH = {
  express: '광역',
  trunk:   '간선',
  local:   '시내',
}

export function getRouteCategory(routeNo) {
  return ROUTE_DISPLAY_CONFIG[routeNo]?.category ?? 'local'
}

// 노선·방향별 경로 — 미니 트랙 시각화의 데이터 소스
export const ROUTE_PATH = {
  '11-A':   { 하교: { origin: '한국공대', waypoints: [], terminus: '정왕역', label: '정왕역행' } },
  '20-1':   { 하교: { origin: '한국공대', waypoints: ['정왕역'], terminus: '아이파크', label: '아이파크아파트행' } },
  '시흥33': {
    하교: { origin: '한국공대',   waypoints: ['정왕역'], terminus: '시흥시청', label: '시흥시청행' },
    등교: { origin: '시흥시청역', waypoints: [],         terminus: '한국공대', label: '학교행' },
  },
  '3400':  {
    하교: { origin: '시화터미널', waypoints: ['사당'], terminus: '강남',   label: '강남행' },
    등교: { origin: '강남',       waypoints: ['사당'], terminus: '시화',   label: '학교행' },
  },
  '3401':  {
    하교: { origin: '이마트',      waypoints: ['시흥시청', '광명'], terminus: '석수',     label: '석수행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'],          terminus: '한국공대', label: '학교행' },
  },
  '5602':  {
    하교: { origin: '이마트',      waypoints: ['시흥시청'], terminus: '구로디지털', label: '구로디지털단지행' },
    등교: { origin: '시흥시청역', waypoints: ['이마트'],   terminus: '한국공대',   label: '학교행' },
  },
  '5200':  { 하교: { origin: '시화터미널', waypoints: ['신천역'], terminus: '신도림',   label: '신도림행' } },
  '99-2':  { 하교: { origin: '시화터미널', waypoints: ['이마트'], terminus: '월곶역',   label: '월곶역 방면' } },
  '6502':  {
    하교: { origin: '이마트', waypoints: [], terminus: '사당',   label: '사당행' },
    등교: { origin: '사당',   waypoints: [], terminus: '이마트', label: '학교행' },
  },
  '시흥1': { 하교: { origin: '이마트',      waypoints: ['신천역'], terminus: '개봉',     label: '개봉행' } },
}

export function getRoutePath(routeNo, category) {
  return ROUTE_PATH[routeNo]?.[category] ?? null
}

// 노선별 경유 정류장 순서 (내부 stop PK 기준).
// 버스가 이 순서대로 정류장을 지나침. RouteProgressStrip에서 사용.
export const ROUTE_WAYPOINTS = {
  '3400': [
    { id: 17, label: '시화터미널' },
    { id: 2,  label: '이마트' },
  ],
  '99-2': [
    { id: 17, label: '시화터미널' },
    { id: 2,  label: '이마트' },
  ],
  '5200': [
    { id: 17, label: '시화터미널' },
    { id: 2,  label: '이마트' },
  ],
}

// 노선 번호로 실시간 도착정보를 조회해야 할 GBIS 정류장 ID를 반환.
// 값이 string이면 카테고리 무관 단일 정류장, object면 카테고리별 정류장.
// 시흥33·3401·5602는 등교(시흥시청역)·하교(이마트/한국공대) 정류장이 서로 달라
// 반드시 카테고리별로 나눠야 한다. 3400 등교(서울측 승차)는 추적 정류장이 없어
// 키 자체를 비워 null로 떨어지게 한다(하교용 시화터미널 ID를 잘못 빌려오면 안 됨).
const _ROUTE_TO_GBIS = {
  '시흥33': { 하교: '224000639', 등교: '224000586' },
  '20-1':  '224000639',
  '11-A':  '224000639',
  '시흥1':  '224000513',
  '3400':  { 하교: '224000861' },
  '3401':  { 하교: '224000513', 등교: '224000586' },
  '5602':  { 하교: '224000513', 등교: '224000586' },
  '99-2':  '224000861',
  '5200':  '224000861',
}

export function getGbisStationIdForRoute(routeNumber, category) {
  const entry = _ROUTE_TO_GBIS[routeNumber]
  if (entry == null) return null
  if (typeof entry === 'string') return entry
  if (category) return entry[category] ?? null
  // 카테고리 미지정 시(레거시 호출부 호환) 첫 값으로 폴백.
  return Object.values(entry)[0] ?? null
}
