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
    },
  },
  이마트: {
    gbisStationId: '224000513',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    perRouteDisplay: {
      '6502':  { origin: '이마트', dest: '사당행' },
      '시흥1': { origin: '이마트', dest: '신천역 경유 개봉행' },
      '3401':  { origin: '이마트', dest: '서울행' },
      '5602':  { origin: '이마트', dest: '구로행' },
      '99-2':  { origin: '이마트', dest: '월곶역 방면' },
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

// 노선+방향별 카드 표시용 출발/도착 레이블 (BusArrivalCard 두 줄 표시에 사용)
const ROUTE_CARD_DISPLAY = {
  '11-A':   { 하교: { origin: '한국공대', dest: '정왕역 경유' } },
  '20-1':   { 하교: { origin: '한국공대', dest: '정왕역 경유' } },
  '시흥33': {
    하교: { origin: '한국공대',   dest: '정왕역 경유 시흥시청행' },
    등교: { origin: '시흥시청역', dest: '학교행' },
  },
  '3400': { 하교: { origin: '시화터미널', dest: '사당 경유 강남행' } },
  '3401': {
    하교: { origin: '이마트',    dest: '서울행' },
    등교: { origin: '시흥시청역', dest: '이마트 경유 학교행' },
  },
  '5602': {
    하교: { origin: '이마트',    dest: '구로행' },
    등교: { origin: '시흥시청역', dest: '이마트 경유 학교행' },
  },
  '6502':  { 하교: { origin: '이마트', dest: '사당행' } },
  '99-2':  { 하교: { origin: '이마트', dest: '월곶역 방면' } },
  '시흥1': { 하교: { origin: '이마트', dest: '신천역 경유 개봉행' } },
}

export function getRouteCardDisplay(routeNo, category) {
  return ROUTE_CARD_DISPLAY[routeNo]?.[category] ?? null
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
  '3400':  { color: '#DC2626', direction: '사당 경유 · 강남행' },
  '6502':  { color: '#DC2626', direction: '사당행' },
  '3401':  { color: '#DC2626', direction: '시흥시청 경유 · 석수행' },
  '5602':  { color: '#2563EB', direction: '시흥시청 경유 · 구로행' },
  '시흥33': { color: '#0891B2', direction: null },
  '20-1':  { color: '#2563EB', direction: null },
  '11-A':  { color: '#0891B2', direction: null },
  '99-2':  { color: '#0891B2', direction: null },
  '시흥1':  { color: '#0891B2', direction: null },
}

export function getRouteDisplayConfig(routeNo) {
  return ROUTE_DISPLAY_CONFIG[routeNo] ?? null
}

// 노선별 경유 정류장 순서 (내부 stop PK 기준).
// 버스가 이 순서대로 정류장을 지나침. RouteProgressStrip에서 사용.
export const ROUTE_WAYPOINTS = {
  '99-2': [
    { id: 17, label: '시화터미널' },
    { id: 2,  label: '이마트' },
  ],
}

// 노선 번호로 실시간 도착정보를 조회해야 할 GBIS 정류장 ID를 반환.
const _ROUTE_TO_GBIS = {
  '시흥33': '224000639',
  '20-1':  '224000639',
  '11-A':  '224000639',
  '시흥1':  '224000513',
  '3401':  '224000586',
  '5602':  '224000586',
  '99-2':  '224000861',
}

export function getGbisStationIdForRoute(routeNumber) {
  return _ROUTE_TO_GBIS[routeNumber] ?? null
}
