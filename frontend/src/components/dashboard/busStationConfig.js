// 정류장별 허용 방향(등교/하교)·기본 방향·포함 노선·GBIS 실시간 정류장 ID 매핑.
// BusPanel/StationPills가 이 상수를 기준으로 pill·방향 탭·필터를 구성한다.

export const BUS_STATION_LABELS = ['한국공학대', '이마트', '시흥시청', '서울']

// pill/배지 등 UI 표시용 축약명. 내부 id('한국공학대')는 persist 호환을 위해 유지하고 표시만 '본캠'으로 매핑한다.
export const BUS_STATION_DISPLAY = {
  '한국공학대': '본캠',
}

export function getBusStationDisplay(id) {
  return BUS_STATION_DISPLAY[id] ?? id
}

export const BUS_DIRECTION_LABELS = ['등교', '하교']

export const BUS_STATIONS = {
  // 본캠 + 시화터미널 통합 — 하교 전용
  // perRouteDisplay로 3400(시화터미널 출발)은 개별 레이블 적용
  한국공학대: {
    gbisStationId: '224000639',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    viaLabel: {
      하교: '정왕역 경유',
    },
    perRouteDisplay: {
      '3400': { origin: '시화터미널', dest: '사당 경유 강남행' },
    },
    routes: {
      하교: ['시흥33', '20-1', '11-A', '3400'],
    },
  },
  이마트: {
    gbisStationId: '224000513',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    routes: {
      하교: ['시흥1', '5602', '6502', '3401'],
    },
  },
  시흥시청: {
    gbisStationId: '224000586',
    allowedDirections: ['등교'],
    defaultDirection: '등교',
    routes: {
      등교: ['5602', '시흥33', '3401'],
    },
  },
  // 서울 출발 등교 전용 — 실시간 없음(시간표 기반)
  서울: {
    gbisStationId: null,
    allowedDirections: ['등교'],
    defaultDirection: '등교',
    perRouteDisplay: {
      '5602': { origin: '구로디지털', dest: '이마트(학교)행' },
      '6502': { origin: '사당',      dest: '이마트(학교)행' },
      '3400': { origin: '강남',      dest: '시화터미널(학교)행' },
      '3401': { origin: '석수역',    dest: '이마트(학교)행' },
    },
    routes: {
      등교: ['5602', '6502', '3400', '3401'],
    },
  },
}

export function getAllowedDirections(station) {
  return BUS_STATIONS[station]?.allowedDirections ?? ['하교']
}

export function getDefaultDirection(station) {
  return BUS_STATIONS[station]?.defaultDirection ?? '하교'
}

export function getRoutesFor(station, direction) {
  return BUS_STATIONS[station]?.routes?.[direction] ?? []
}

export function getGbisStationId(station) {
  return BUS_STATIONS[station]?.gbisStationId ?? null
}

export function getViaLabel(station, direction) {
  return BUS_STATIONS[station]?.viaLabel?.[direction] ?? null
}

export function getDisplayOrigin(station, direction) {
  return BUS_STATIONS[station]?.displayOrigin?.[direction] ?? null
}

export function getPerRouteDisplay(station) {
  return BUS_STATIONS[station]?.perRouteDisplay ?? null
}

// 노선 번호로 실시간 도착정보를 조회해야 할 GBIS 정류장 ID를 반환.
// 같은 노선이 여러 정류장에 속할 일은 없으므로 첫 매치를 사용한다.
export function getGbisStationIdForRoute(routeNumber) {
  for (const cfg of Object.values(BUS_STATIONS)) {
    if (!cfg.gbisStationId) continue
    for (const routes of Object.values(cfg.routes)) {
      if (routes.includes(routeNumber)) return cfg.gbisStationId
    }
  }
  return null
}
