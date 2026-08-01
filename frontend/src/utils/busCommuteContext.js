export const BUS_COMMUTE_GROUPS = {
  하교: [
    { id: 'to-jeongwang', label: '정왕역 방면' },
    { id: 'to-siheung-city-hall', label: '시흥시청 방면' },
    { id: 'to-seoul', label: '서울 방면' },
  ],
  등교: [
    { id: 'from-seoul', label: '서울 출발' },
    { id: 'from-siheung-city-hall', label: '시흥시청 출발' },
  ],
}

const CONTEXTS = {
  하교: {
    'to-jeongwang': {
      '11-A': { origin: '학교', destination: '정왕역', journey: ['학교', '정왕역'], realtimeStationId: '224000639', stopId: 3 },
      '20-1': { origin: '학교', destination: '정왕역', journey: ['학교', '정왕역'], realtimeStationId: '224000639', stopId: 3 },
      '시흥33': { origin: '학교', destination: '정왕역', journey: ['학교', '정왕역'], realtimeStationId: '224000639', stopId: 3 },
    },
    'to-siheung-city-hall': {
      '시흥33': { origin: '학교', destination: '시흥시청', journey: ['학교', '정왕역', '시흥시청'], realtimeStationId: '224000639', stopId: 3 },
      '3401': { origin: '학교', destination: '시흥시청', journey: ['학교', '이마트 환승', '시흥시청'], realtimeStationId: '224000513', stopId: 2 },
      '5602': { origin: '학교', destination: '시흥시청', journey: ['학교', '이마트 환승', '시흥시청'], realtimeStationId: '224000513', stopId: 2 },
    },
    'to-seoul': {
      '3401': { origin: '학교', destination: '석수역', journey: ['학교', '이마트 환승', '시흥시청', '광명', '석수역'], realtimeStationId: '224000513', stopId: 2 },
      '5602': { origin: '학교', destination: '구로디지털단지', journey: ['학교', '이마트 환승', '시흥시청', '구로디지털단지'], realtimeStationId: '224000513', stopId: 2 },
      '3400': { origin: '학교', destination: '강남역', journey: ['학교', '시화터미널 환승', '사당', '강남역'], realtimeStationId: '224000861', stopId: 17 },
      '6502': { origin: '학교', destination: '사당역', journey: ['학교', '이마트 환승', '사당역'], realtimeStationId: '224000513', stopId: 2 },
      '5200': { origin: '학교', destination: '신도림역', journey: ['학교', '시화터미널 환승', '신천역', '신도림역'], realtimeStationId: '224000861', stopId: 17 },
      '시흥1': { origin: '학교', destination: '개봉', journey: ['학교', '이마트 환승', '신천역', '개봉'], realtimeStationId: '224000513', stopId: 2 },
    },
  },
  등교: {
    'from-seoul': {
      '3400': { origin: '강남역', destination: '학교', journey: ['강남역', '사당', '학교'], realtimeStationId: null, stopId: 6 },
      '3401': { origin: '석수역', destination: '학교', journey: ['석수역', '광명', '시흥시청', '이마트', '학교'], realtimeStationId: null, stopId: 7 },
      '5602': { origin: '구로디지털단지역', destination: '학교', journey: ['구로디지털단지역', '시흥시청', '이마트', '학교'], realtimeStationId: null, stopId: 8 },
      '6502': { origin: '사당역', destination: '학교', journey: ['사당역', '학교'], realtimeStationId: null, stopId: 5 },
    },
    'from-siheung-city-hall': {
      '3401': { origin: '시흥시청역', destination: '학교', journey: ['시흥시청역', '이마트', '학교'], realtimeStationId: '224000586', stopId: 13 },
      '5602': { origin: '시흥시청역', destination: '학교', journey: ['시흥시청역', '이마트', '학교'], realtimeStationId: '224000586', stopId: 13 },
      '시흥33': { origin: '시흥시청역', destination: '학교', journey: ['시흥시청역', '학교'], realtimeStationId: '224000586', stopId: 13 },
    },
  },
}

export function getCommuteContext(routeNumber, category, groupId) {
  const context = CONTEXTS[category]?.[groupId]?.[routeNumber]
  if (!context) return null
  return { id: groupId, category, label: BUS_COMMUTE_GROUPS[category]?.find((group) => group.id === groupId)?.label, ...context }
}

export function getRoutesForCommuteGroup(routes, category, groupId) {
  if (!Array.isArray(routes)) return []
  return routes.filter((route) =>
    route.category === category && getCommuteContext(route.route_number, category, groupId) != null
  )
}
