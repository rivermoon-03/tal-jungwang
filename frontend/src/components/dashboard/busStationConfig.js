// 정류장별 허용 방향(등교/하교)·기본 방향·포함 노선·GBIS 실시간 정류장 ID 매핑.
// BusPanel/StationPills가 이 상수를 기준으로 pill·방향 탭·필터를 구성한다.

export const BUS_STATION_LABELS = ['한국공학대', '시화터미널', '이마트']

export const BUS_DIRECTION_LABELS = ['등교', '하교']

export const BUS_STATIONS = {
  한국공학대: {
    gbisStationId: '224000639',
    allowedDirections: ['하교'],
    defaultDirection: '하교',
    routes: {
      하교: ['시흥33', '20-1'],
    },
  },
  시화터미널: {
    gbisStationId: null,
    allowedDirections: ['등교', '하교'],
    defaultDirection: '하교',
    routes: {
      등교: ['3400'],
      하교: ['3400'],
    },
  },
  이마트: {
    gbisStationId: '224000513',
    allowedDirections: ['등교', '하교'],
    defaultDirection: '하교',
    routes: {
      등교: ['6502', '5602', '3401'],
      하교: ['시흥1', '5602', '6502', '3401'],
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
