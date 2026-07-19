// M-2: 노선·정류장 검색 오버레이용 클라이언트 정적 인덱스.
// 소스 데이터를 매번 새로 만들지 않도록 모듈 로드 시 1회만 빌드해 둔다.
//
// 엔트리 shape: { type: 'route' | 'station' | 'subway' | 'shuttle', id, label, sub, keywords: [...] }
// - route:   버스 노선 (id = 노선번호, RouteDetailPage 라우팅에 그대로 사용)
// - station: 버스 정류장 (id = busStationConfig 키, setBusStation과 동일 값)
// - subway:  지하철역 (id = 원본 역명, setSubwayStation은 지원 3역만 재사용)
// - shuttle: 셔틀 등교/하교 (id 고유값 + campus: 'main' | 'second')

import {
  BUS_STATION_LABELS,
  ROUTE_DISPLAY_CONFIG,
  getBusStationDisplay,
} from '../components/dashboard/busStationConfig'
import { STATION_SEQUENCES } from './subwayStations'

const SUBWAY_LINE_LABELS = {
  '4호선': '4호선',
  '수인분당선': '수인분당선',
  '서해선': '서해선',
}

function buildRouteEntries() {
  return Object.entries(ROUTE_DISPLAY_CONFIG).map(([routeNo, cfg]) => ({
    type: 'route',
    id: routeNo,
    label: routeNo,
    sub: cfg.direction ?? '버스 노선',
    keywords: [routeNo, cfg.direction, cfg.category].filter(Boolean),
  }))
}

function buildStationEntries() {
  return BUS_STATION_LABELS.map((id) => {
    const display = getBusStationDisplay(id)
    return {
      type: 'station',
      id,
      label: display,
      sub: '버스 정류장',
      keywords: [id, display],
    }
  })
}

function buildSubwayEntries() {
  // 같은 역이 여러 노선에 걸쳐 나오므로(예: 정왕 = 4호선 + 수인분당선) 이름 기준으로 dedupe.
  const byName = new Map()
  for (const [line, dirs] of Object.entries(STATION_SEQUENCES)) {
    const names = new Set([...(dirs.상행 ?? []), ...(dirs.하행 ?? [])])
    const lineLabel = SUBWAY_LINE_LABELS[line] ?? line
    for (const name of names) {
      if (!byName.has(name)) byName.set(name, new Set())
      byName.get(name).add(lineLabel)
    }
  }
  return Array.from(byName.entries()).map(([name, lines]) => {
    const label = name.endsWith('역') ? name : `${name}역`
    return {
      type: 'subway',
      id: name,
      label,
      sub: Array.from(lines).join(' · '),
      keywords: [name, label],
    }
  })
}

const SHUTTLE_ENTRIES = [
  {
    type: 'shuttle', id: 'shuttle-main-to', label: '셔틀버스 등교', sub: '본캠 셔틀',
    keywords: ['셔틀', '셔틀버스', '등교', '본캠'], campus: 'main',
  },
  {
    type: 'shuttle', id: 'shuttle-main-from', label: '셔틀버스 하교', sub: '본캠 셔틀',
    keywords: ['셔틀', '셔틀버스', '하교', '본캠'], campus: 'main',
  },
  {
    type: 'shuttle', id: 'shuttle-second-to', label: '셔틀버스 등교', sub: '제2캠퍼스 셔틀',
    keywords: ['셔틀', '셔틀버스', '등교', '2캠', '제2캠'], campus: 'second',
  },
  {
    type: 'shuttle', id: 'shuttle-second-from', label: '셔틀버스 하교', sub: '제2캠퍼스 셔틀',
    keywords: ['셔틀', '셔틀버스', '하교', '2캠', '제2캠'], campus: 'second',
  },
]

const ALL_ENTRIES = [
  ...buildRouteEntries(),
  ...buildStationEntries(),
  ...buildSubwayEntries(),
  ...SHUTTLE_ENTRIES,
]

function normalize(s) {
  return (s ?? '').toString().trim().toLowerCase()
}

// 점수가 낮을수록 먼저 나온다. id(노선번호/정류장 키) 일치를 라벨·키워드보다 우선한다
// — "노선번호 우선, 그다음 라벨/키워드" 요구사항.
function scoreEntry(entry, q) {
  const id = normalize(entry.id)
  const label = normalize(entry.label)
  if (id === q) return 0
  if (id.startsWith(q)) return 1
  if (id.includes(q)) return 2
  if (label.startsWith(q)) return 3
  if (label.includes(q)) return 4
  if (entry.keywords?.some((k) => normalize(k).includes(q))) return 5
  if (entry.sub && normalize(entry.sub).includes(q)) return 6
  return null
}

/**
 * searchEntries(query) — 숫자/문자 부분일치. 노선번호 우선, 그다음 라벨/키워드.
 * 최대 8건. 빈 질의는 빈 배열.
 */
export function searchEntries(query, limit = 8) {
  const q = normalize(query)
  if (!q) return []
  const scored = []
  for (const entry of ALL_ENTRIES) {
    const score = scoreEntry(entry, q)
    if (score != null) scored.push({ entry, score })
  }
  scored.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score
    return a.entry.label.length - b.entry.label.length
  })
  return scored.slice(0, limit).map((s) => s.entry)
}

// SearchOverlay가 지하철 결과를 탭했을 때 setSubwayStation을 안전하게 호출할 수 있는
// 대상만 화이트리스트. 앱이 실제로 선택 가능한 역은 3개뿐이라(StationPills SUBWAY_OPTIONS),
// 그 외 역(예: 서울숲)을 store에 그대로 넣으면 다른 화면이 깨질 수 있다.
export const SELECTABLE_SUBWAY_STATIONS = ['정왕', '초지', '시흥시청']
