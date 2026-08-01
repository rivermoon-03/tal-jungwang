// 화면에 노출하는 통학 선택 축만 프런트에 둔다.
// 노선 포함 여부와 시간표/실시간 기준 정류장은 /bus/commute-contexts가 단일 출처다.
export const BUS_COMMUTE_GROUPS = {
  하교: [
    { id: 'to-jeongwang', label: '정왕역 방면' },
    { id: 'to-siheung-city-hall', label: '시흥시청 방면' },
    { id: 'to-seoul', label: '서울 방면' },
    { id: 'to-wolgot', label: '월곶역 방면' },
  ],
  등교: [
    { id: 'from-seoul', label: '서울 출발' },
    { id: 'from-siheung-city-hall', label: '시흥시청 출발' },
  ],
}
