/**
 * 마커 시트의 "상세 보기" 가 시간표 화면에 넘기는 힌트를 만든다.
 *
 * group 은 시간표 화면이 아는 id 여야 한다. 버스는 SchedulePage 의
 * BUS_GROUP_IDS(하교·등교·기타), 셔틀은 캠퍼스(main·second), 지하철은 역 이름이다.
 * 예전엔 '정왕역행'·'버스 - 서울행' 처럼 어디에도 없는 값을 넘겼고,
 * SchedulePage 가 그대로 setBusGroup 해서 /bus/routes?category=정왕역행 → []
 * 가 됐다. 모든 버스 마커의 상세 보기가 빈 목록으로 떨어지던 원인이다.
 *
 * 순수 함수로 떼어 둔 이유는 MapView 안에서는 이 규칙을 테스트할 수 없어서다.
 */

/** 학교 주변 허브(bus_hub_jw_*)는 하교 출발, 서울 허브는 등교 출발이다. */
function busGroupFor(station) {
  return station.type === 'bus' || station.isLocalHub ? '하교' : '등교'
}

export function buildScheduleHint(station) {
  if (!station) return null

  switch (station.type) {
    case 'shuttle':
      return { mode: 'shuttle', group: (station.direction ?? 0) >= 2 ? 'second' : 'main' }
    case 'subway':
      return { mode: 'subway', group: '정왕' }
    case 'seohae':
      return { mode: 'subway', group: station.tabId === 'choji' ? '초지' : '시흥시청' }
    case 'bus':
      return { mode: 'bus', group: busGroupFor(station) }
    case 'bus_seoul':
      return { mode: 'bus', group: busGroupFor(station), routeCode: station.route }
    default:
      return null
  }
}
