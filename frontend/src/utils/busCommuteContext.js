// 화면에 노출하는 통학 선택 축만 프런트에 둔다.
// 노선 포함 여부와 시간표/실시간 기준 정류장은 /bus/commute-contexts가 단일 출처다.
//
// 하교는 화면에 방면 탭을 두지 않는다(2026-09). 시흥33이 "학교→정왕역"과
// "학교→정왕역→시흥시청역" 두 방면 탭에 각각 뜨는데, 실제로는 같은 버스를
// 어디서 내리느냐만 다른 같은 운행이었다(사용자 지적). DB를 조회해 보니
// 3401·5602도 같은 패턴으로 시흥시청/서울 방면에 중복 노출되고 있었다 —
// 시흥33만 고치면 3401·5602는 여전히 두 방면에 겹쳐 보인다. 그래서 정왕역
// 하나만이 아니라 네 방면(정왕역/시흥시청/서울/월곶) 전부를 한 목록으로
// 합쳤다. DB 쪽은 짧은 여정(부분 구간) 컨텍스트를 지워 중복을 없앴고
// (scripts/prod_migration_20260904_dedupe_hagyo_bus_commute_contexts.sql),
// 남은 컨텍스트는 journey_labels(경유지)를 그대로 카드 부제에 쓴다.
//
// 이 배열 자체는 지우지 않는다 — SchedulePage.jsx가 하교 화면에서 네
// group_key를 모두 조회해 병합하는 목록을 만들 때, ScheduleDetailModal.jsx가
// 노선이 여러 group_key에 걸치는지 판정할 때(상세 안 방면 전환 탭) 각각
// 이 배열을 그대로 참조한다. 위 DB 정리 이후로는 하교 노선이 group_key
// 두 개에 동시에 남지 않아 상세 쪽 방면 탭도 자연히 뜨지 않는다.
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
