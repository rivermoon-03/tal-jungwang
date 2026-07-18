/**
 * clusterStations — 픽셀 거리 기반 그리디 그룹화 순수 함수 테스트.
 * 카카오맵 SDK 의존 없이 좌표 배열 → 그룹 배열 변환만 검증한다.
 */

import { describe, it, expect } from 'vitest'
import { clusterStationPoints, DEFAULT_CLUSTER_THRESHOLD_PX } from './clusterStations'

describe('clusterStationPoints', () => {
  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(clusterStationPoints([], 44)).toEqual([])
  })

  it('점이 하나면 단일 그룹(ids.length===1)으로 반환한다', () => {
    const groups = clusterStationPoints([{ id: 'a', x: 10, y: 10 }], 44)
    expect(groups).toHaveLength(1)
    expect(groups[0].ids).toEqual(['a'])
    expect(groups[0].x).toBe(10)
    expect(groups[0].y).toBe(10)
  })

  it('threshold보다 멀리 떨어진 두 점은 각각 별도 그룹이다', () => {
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 200, y: 0 },
      ],
      44,
    )
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.ids)).toEqual([['a'], ['b']])
  })

  it('threshold 이내인 두 점은 하나의 그룹으로 묶이고 centroid를 반환한다', () => {
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 0 },
      ],
      44,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].ids.sort()).toEqual(['a', 'b'])
    expect(groups[0].x).toBe(5)
    expect(groups[0].y).toBe(0)
  })

  it('경계값(정확히 threshold와 같은 거리)은 같은 그룹으로 묶인다 (<=)', () => {
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 44, y: 0 },
      ],
      44,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].ids.sort()).toEqual(['a', 'b'])
  })

  it('일렬로 늘어선 세 점이 모두 시드의 threshold 이내면 한 그룹으로 합쳐진다', () => {
    // a(0,0) - b(20,0) - c(40,0): 모두 초기 centroid(a 기준 0,0)에서 threshold(44) 이내라
    // 첫 while pass에서 b, c가 동시에 편입된다.
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 40, y: 0 },
      ],
      44,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].ids.sort()).toEqual(['a', 'b', 'c'])
  })

  it('centroid 기준으로 성장하므로 무한 체이닝(끝없이 늘어지는 병합)은 발생하지 않는다', () => {
    // a(0,0) - b(20,0): 초기 centroid(0,0) 기준 20<=25라 묶임 → group centroid는 (10,0)으로 이동.
    // c(40,0)은 새 centroid(10,0)에서 거리 30 > 25라 편입되지 않고 별도 그룹이 된다.
    // (고전적 single-linkage였다면 b-c 거리 20으로 체이닝되어 하나로 합쳐졌을 케이스)
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 20, y: 0 },
        { id: 'c', x: 40, y: 0 },
      ],
      25,
    )
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.ids.length).sort()
    expect(sizes).toEqual([1, 2])
  })

  it('두 개의 독립적인 클러스터가 서로 멀리 떨어져 있으면 그룹이 분리된다', () => {
    const groups = clusterStationPoints(
      [
        { id: 'a1', x: 0, y: 0 },
        { id: 'a2', x: 10, y: 0 },
        { id: 'b1', x: 500, y: 500 },
        { id: 'b2', x: 510, y: 500 },
      ],
      44,
    )
    expect(groups).toHaveLength(2)
    const sizes = groups.map((g) => g.ids.length).sort()
    expect(sizes).toEqual([2, 2])
  })

  it('기본 threshold 상수(DEFAULT_CLUSTER_THRESHOLD_PX)는 44px이다', () => {
    expect(DEFAULT_CLUSTER_THRESHOLD_PX).toBe(44)
  })

  it('3개 이상 station이 좁은 반경 안에 있으면 하나의 그룹(count>=2)으로 묶인다', () => {
    const groups = clusterStationPoints(
      [
        { id: '1', x: 100, y: 100 },
        { id: '2', x: 105, y: 102 },
        { id: '3', x: 98, y: 108 },
      ],
      44,
    )
    expect(groups).toHaveLength(1)
    expect(groups[0].ids).toHaveLength(3)
  })

  it('threshold=0이면 완전히 동일 좌표가 아닌 이상 그룹화하지 않는다', () => {
    const groups = clusterStationPoints(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 1, y: 0 },
      ],
      0,
    )
    expect(groups).toHaveLength(2)
  })
})
