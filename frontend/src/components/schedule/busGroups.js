/**
 * 시간표 화면의 버스 그룹 id.
 *
 * 지도 마커의 상세 보기 힌트(map/scheduleHint.js)가 이 목록에 없는 값을 넘기면
 * SchedulePage 가 그대로 setBusGroup 해서 /bus/routes?category=... 가 빈 배열이
 * 된다. 실제로 '정왕역행'·'버스 - 서울행' 이 그렇게 넘어가 모든 버스 마커의
 * 상세 보기가 빈 목록으로 떨어졌다. 두 파일이 같은 출처를 보게 여기 둔다.
 *
 * 컴포넌트 파일이 아니라 별도 모듈인 이유는 react-refresh 규칙이다.
 */
export const BUS_GROUP_IDS = [
  { id: '하교', label: '하교' },
  { id: '등교', label: '등교' },
  { id: '기타', label: '기타 노선' },
]
