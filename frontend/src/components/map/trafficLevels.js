// 교통 혼잡도 단계의 색과 이름. TrafficRoadOverlay(지도 위 링)와
// MapLegendOnboarding(범례)이 같은 값을 읽는다. 색을 두 곳에서 따로 정하지 않는다.
export const CONGESTION_COLOR = {
  1: '#22c55e', // 원활
  2: '#eab308', // 서행
  3: '#f97316', // 지체
  4: '#ef4444', // 정체
}

export const CONGESTION_LABEL = {
  1: '원활',
  2: '서행',
  3: '지체',
  4: '정체',
}
