/**
 * clusterStations — 화면 픽셀 거리 기반 마커 그룹화 순수 함수.
 *
 * ZoomAwareOverlayManager.jsx가 kakao map projection으로 각 station의
 * 컨테이너 픽셀 좌표를 구한 뒤, 이 함수로 "겹치는 마커"를 그룹으로 묶는다.
 * 카카오맵 SDK에 의존하지 않는 순수 함수라 유닛 테스트로 검증한다.
 *
 * 알고리즘: 그리디 단일 연결(single-linkage) 클러스터링.
 *   1. 아직 그룹에 속하지 않은 점 하나를 골라 새 그룹을 시작한다.
 *   2. 그룹의 centroid(평균 좌표)를 기준으로, threshold(px) 이내의
 *      미배정 점을 그룹에 편입시킨다.
 *   3. 편입이 있었으면 centroid를 다시 계산해 반복한다(체이닝 방지 위해
 *      centroid 기준 재평가 — 그룹이 커질수록 어색하게 늘어나는 것을 억제).
 *   4. 더 이상 편입될 점이 없으면 그룹을 확정하고 다음 미배정 점으로 이동.
 *
 * 입력 순서에 안정적이도록(테스트 결정성) 입력 배열 순서를 그대로 순회한다.
 */

/**
 * @param {{ id: string|number, x: number, y: number }[]} points
 * @param {number} thresholdPx 이 거리(px) 이내면 같은 그룹으로 묶는다.
 * @returns {{ ids: (string|number)[], x: number, y: number }[]}
 *   그룹 배열. 각 그룹의 x/y는 그룹 내 점들의 centroid.
 *   ids.length === 1 이면 그룹화되지 않은 단일 station.
 */
export function clusterStationPoints(points, thresholdPx = 44) {
  if (!Array.isArray(points) || points.length === 0) return []

  const used = new Set()
  const groups = []

  for (let i = 0; i < points.length; i++) {
    const seed = points[i]
    if (used.has(seed.id)) continue

    const group = [seed]
    used.add(seed.id)

    let grew = true
    while (grew) {
      grew = false
      const cx = group.reduce((sum, p) => sum + p.x, 0) / group.length
      const cy = group.reduce((sum, p) => sum + p.y, 0) / group.length

      for (let j = 0; j < points.length; j++) {
        const candidate = points[j]
        if (used.has(candidate.id)) continue

        const dx = candidate.x - cx
        const dy = candidate.y - cy
        if (Math.sqrt(dx * dx + dy * dy) <= thresholdPx) {
          group.push(candidate)
          used.add(candidate.id)
          grew = true
        }
      }
    }

    const cx = group.reduce((sum, p) => sum + p.x, 0) / group.length
    const cy = group.reduce((sum, p) => sum + p.y, 0) / group.length
    groups.push({ ids: group.map((p) => p.id), x: cx, y: cy })
  }

  return groups
}

// 44px(최소 터치 타겟 크기)로 배포해 실측했더니 실기기 버그 리포트의 정확히 그 케이스
// ("하교"/"제2 등교" 칩)가 anchor 거리 약 52.6px로 threshold를 살짝 넘겨 여전히 안 묶였다.
// MarkerChip 칩은 xAnchor:0.5·yAnchor:1.0(칩+꼬리 wrapper 하단 중앙) 기준인데 칩 자체가
// 정류장명 길이에 따라 110~160px 폭의 알약형이라, "겹쳐 보임"은 anchor 간 거리가 아니라
// 칩 폭의 절반 두 개(≈ 칩 평균 폭)만큼 떨어져 있어도 이미 발생한다. 이 실측값을 반영해
// 최소 터치 타겟보다 칩 평균 폭에 가깝게 상향.
/** 클러스터링 임계값(px) — 겹치는 칩 라벨을 실제로 잡아내는 값(위 설명 참고). */
export const DEFAULT_CLUSTER_THRESHOLD_PX = 110

/** 클러스터 배지 탭 시 줌인할 레벨 단계(카카오 level 기준, 클수록 더 확대). */
export const CLUSTER_TAP_ZOOM_STEP = 2
