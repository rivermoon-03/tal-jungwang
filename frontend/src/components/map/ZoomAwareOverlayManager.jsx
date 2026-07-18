/**
 * ZoomAwareOverlayManager — 줌 레벨에 따라 마커를 Chip ↔ Dot으로 전환하는 오버레이 관리자.
 *
 * 카카오맵 레벨 규칙:
 *   level 1 = 가장 가까이 (closest)
 *   level 14 = 가장 멀리 (farthest)
 *
 * 스펙 §6.1:
 *   "줌 ≥ 14 (더 가까이) → Chip, 줌아웃(더 멀리, level > 5) → Dot"
 *   → 카카오 level ≤ 5 : Chip 표시
 *   → 카카오 level > 5 : Dot 표시
 *
 * Props:
 *   map        — kakao.maps.Map 인스턴스
 *   stations   — [{ id, name, type, lat, lng, routeCode, routeColor, liveMinutes?, showLive? }]
 *   onTap      — (station) => void  마커 탭 콜백
 *
 * 이 컴포넌트는 DOM을 직접 조작하며 렌더 출력은 null.
 * 모든 window.kakao.* 코드는 이 파일(map 에이전트 담당)에서만 사용.
 *
 * ── 성능: diff 업데이트 ─────────────────────────────────────────
 * stations 배열은 분 단위 라이브 데이터가 60초 tick마다 새 참조로 들어오지만
 * id 집합·위치는 거의 변하지 않는다. 매번 전량 파괴/재생성(setMap(null) + createElement)하면
 * 1분마다 수백 DOM 노드가 재생성되고 지도 레이어가 reflow된다.
 *
 * 그래서 station.id를 키로 overlaysRef(Map)를 유지하고 diff만 적용한다:
 *   - 새 id        → CustomOverlay 생성
 *   - 사라진 id    → 해당 overlay만 setMap(null)
 *   - 라이브 값만 변경(같은 mode·위치) → overlay 파괴 없이 setContent(...)로 콘텐츠만 교체
 *   - mode/위치 변경 → 콘텐츠 재생성 후 setContent
 * overlay 인스턴스 자체(지도 레이어 attach)는 유지되므로 분 단위 갱신에서 레이어 reflow가 사라진다.
 *
 * ── 클러스터링 ───────────────────────────────────────────────
 * 실기기에서 정류장이 화면상 가까우면 chip/dot이 겹쳐 라벨을 읽을 수 없다.
 * 매 렌더마다 map projection으로 각 station의 컨테이너 픽셀 좌표를 구하고,
 * 순수 함수 `clusterStationPoints`(clusterStations.js)로 CLUSTER_THRESHOLD_PX
 * 이내 station들을 그리디하게 묶는다. 그룹 크기 >= 2면 개별 chip/dot 대신
 * "+N" 클러스터 배지 하나만 표시(centroid 위치, id는 정렬된 구성원 id 조합).
 * 배지를 탭하면 MarkerSheet를 열지 않고 해당 위치로 줌인해 겹침을 해소한다.
 *
 * 클러스터 그룹은 zoom_changed 시(그리고 stations 갱신에 따른 effect 재실행 시)
 * 재계산된다. diff 적용 로직(applyDiff)을 공유해 기존 add/update/remove
 * 최적화 패턴을 클러스터 항목에도 동일하게 적용한다 — 그룹 구성이 그대로면
 * (분 단위 라이브 tick만 바뀌는 흔한 경우) overlay 재생성 없이 setContent만 호출된다.
 */

import { useEffect, useRef } from 'react'
import { createMarkerChipElement, createSubwayMultiChipElement, createSeohaeSiheungChipElement, createClusterBadgeElement } from './MarkerChip'
import { createMarkerDotElement } from './MarkerDot'
import { clusterStationPoints, DEFAULT_CLUSTER_THRESHOLD_PX, CLUSTER_TAP_ZOOM_STEP } from './clusterStations'

// 줌 임계값: 이 값 이하이면 Chip 표시
const CHIP_ZOOM_THRESHOLD = 6

// 클러스터링 픽셀 거리 임계값(px). 마커 최소 터치 타겟 크기와 맞춤.
const CLUSTER_THRESHOLD_PX = DEFAULT_CLUSTER_THRESHOLD_PX

// chip 콘텐츠에 영향을 주는 라이브/표시 필드만 모은 시그니처.
// 이 값이 같으면 mode/위치 변화가 없는 한 콘텐츠 재생성 불필요.
function contentSignature(s) {
  if (s.__cluster) return JSON.stringify(['cluster', s.__clusterCount])
  return JSON.stringify([
    s.chipVariant ?? null,
    s.routeCode ?? null,
    s.routeColor ?? null,
    s.name ?? null,
    s.liveMinutes ?? null,
    s.showLive ?? false,
    s.liveInaccurate ?? false,
    s.badgeText ?? null,
    s.extraPillText ?? null,
    s.subLabel ?? null,
    s.iconType ?? null,
    s.subLabelSep ?? null,
    s.upMinutes ?? null,
    s.dnMinutes ?? null,
    s.earliestBus ?? null,
    // subwayMulti chip은 subwayData에서 분을 직접 계산하므로 도착 초들을 시그니처에 포함
    s.subwayData
      ? ['up', 'down', 'line4_up', 'line4_down'].map((k) => s.subwayData[k]?.arrive_in_seconds ?? null)
      : null,
  ])
}

export default function ZoomAwareOverlayManager({ map, stations = [], onTap }) {
  // overlaysRef: Map<id, { overlay, station, mode, sig }>
  const overlaysRef = useRef(new Map())
  // onTap을 ref로 보관 → 콘텐츠 빌더는 항상 최신 onTap을 보되 effect 재실행을 유발하지 않음
  const onTapRef = useRef(onTap)
  onTapRef.current = onTap

  useEffect(() => {
    if (!map || !window.kakao?.maps) return

    const handleTap = (station) => onTapRef.current?.(station)

    // chip content 빌더 (variant 분기)
    function buildChipContent(station) {
      if (station.chipVariant === 'subwayMulti') {
        return createSubwayMultiChipElement({
          subwayData: station.subwayData,
          onClick: () => handleTap(station),
        })
      }
      if (station.chipVariant === 'seohaeSiheung') {
        return createSeohaeSiheungChipElement({
          stationName: station.name,
          upMinutes:   station.upMinutes ?? null,
          dnMinutes:   station.dnMinutes ?? null,
          earliestBus: station.earliestBus ?? null,
          onClick: () => handleTap(station),
        })
      }
      return createMarkerChipElement({
        routeCode:   station.routeCode,
        routeColor:  station.routeColor,
        stationName: station.name,
        liveMinutes: station.liveMinutes ?? null,
        showLive:    station.showLive ?? false,
        inaccurate:  station.liveInaccurate ?? false,
        badgeText:   station.badgeText,
        extraPillText: station.extraPillText ?? null,
        subLabel:    station.subLabel ?? null,
        iconType:    station.iconType ?? null,
        subLabelSep: station.subLabelSep ?? '·',
        onClick: () => handleTap(station),
      })
    }

    // 클러스터 배지 탭 → MarkerSheet를 열지 않고 해당 위치로 줌인해 겹침을 해소
    function handleClusterTap(clusterItem) {
      const anchor = new window.kakao.maps.LatLng(clusterItem.lat, clusterItem.lng)
      const nextLevel = Math.max(1, map.getLevel() - CLUSTER_TAP_ZOOM_STEP)
      map.setLevel(nextLevel, { anchor })
    }

    function buildContent(item, mode) {
      if (item.__cluster) {
        return createClusterBadgeElement({
          count: item.__clusterCount,
          onClick: () => handleClusterTap(item),
        })
      }
      return mode === 'chip'
        ? buildChipContent(item)
        : createMarkerDotElement({
            type:        item.type,
            customColor: item.routeColor,
            onClick: () => handleTap(item),
          })
    }

    // 현재 줌 레벨에 맞는 mode 결정
    const modeForLevel = (level) => (level <= CHIP_ZOOM_THRESHOLD ? 'chip' : 'dot')

    // stations → 화면 픽셀 좌표 기준으로 그룹화한 렌더 항목 목록.
    // 그룹 크기 1이면 원래 station 객체 그대로(개별 chip/dot 유지),
    // 2 이상이면 centroid 위치의 합성 클러스터 항목으로 대체.
    function computeRenderItems(list) {
      if (!list.length || !map.getProjection) return list

      const projection = map.getProjection()
      if (!projection) return list

      const points = list.map((s) => {
        const p = projection.containerPointFromCoords(new window.kakao.maps.LatLng(s.lat, s.lng))
        return { id: s.id, x: p.x, y: p.y }
      })

      const groups = clusterStationPoints(points, CLUSTER_THRESHOLD_PX)
      const byId = new Map(list.map((s) => [s.id, s]))
      const items = []

      for (const group of groups) {
        if (group.ids.length === 1) {
          items.push(byId.get(group.ids[0]))
          continue
        }
        const centerLatLng = projection.coordsFromContainerPoint(
          new window.kakao.maps.Point(group.x, group.y)
        )
        const sortedIds = [...group.ids].sort()
        items.push({
          id: `cluster:${sortedIds.join('|')}`,
          lat: centerLatLng.getLat(),
          lng: centerLatLng.getLng(),
          __cluster: true,
          __clusterCount: group.ids.length,
          __clusterIds: sortedIds,
        })
      }

      return items
    }

    // ── diff: id 집합 + 라이브 값 변화를 한 번에 처리 (station·클러스터 공통) ──
    const refMap = overlaysRef.current

    function applyDiff(items, mode) {
      const nextIds = new Set()

      for (const item of items) {
        nextIds.add(item.id)
        const sig = contentSignature(item)
        const existing = refMap.get(item.id)

        if (!existing) {
          // 새 항목 → overlay 생성
          const pos = new window.kakao.maps.LatLng(item.lat, item.lng)
          const overlay = new window.kakao.maps.CustomOverlay({
            position: pos,
            content:  buildContent(item, mode),
            xAnchor:  0.5,
            yAnchor:  item.__cluster ? 0.5 : 1.0,
            zIndex:   item.__cluster ? 5 : 4,
          })
          overlay.setMap(map)
          refMap.set(item.id, { overlay, station: item, mode, sig })
          continue
        }

        // 위치 변경 여부 (마커 위치는 거의 불변, 클러스터 centroid는 pan/zoom에 따라 바뀔 수 있음)
        const moved = existing.station.lat !== item.lat || existing.station.lng !== item.lng
        const contentChanged = existing.sig !== sig || existing.mode !== mode

        // station 참조 최신화 (onTap 콜백이 최신 데이터를 닫도록)
        existing.station = item

        if (moved) {
          existing.overlay.setPosition(new window.kakao.maps.LatLng(item.lat, item.lng))
        }

        if (contentChanged) {
          // overlay는 파괴하지 않고 콘텐츠만 교체 → 지도 레이어 reflow 없음
          existing.overlay.setContent(buildContent(item, mode))
          existing.mode = mode
          existing.sig  = sig
        }
      }

      // 사라진 항목 제거 (station이 빠지거나, 클러스터 구성이 바뀌어 key가 달라진 경우 포함)
      for (const [id, item] of refMap) {
        if (!nextIds.has(id)) {
          item.overlay.setMap(null)
          refMap.delete(id)
        }
      }
    }

    applyDiff(computeRenderItems(stations), modeForLevel(map.getLevel()))

    // ── zoom_changed: mode(chip↔dot) 갱신 + 클러스터 재계산 ──
    // 줌 레벨이 바뀌면 화면 픽셀 거리가 달라져 그룹 구성 자체가 바뀔 수 있으므로
    // mode 토글만이 아니라 전체 diff를 재적용한다.
    function handleZoomChange() {
      applyDiff(computeRenderItems(stations), modeForLevel(map.getLevel()))
    }

    window.kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChange)

    return () => {
      window.kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChange)
    }
  }, [map, stations])

  // 언마운트 시 모든 overlay 정리 (map 변경/컴포넌트 제거)
  useEffect(() => {
    const refMap = overlaysRef.current
    return () => {
      for (const item of refMap.values()) item.overlay.setMap(null)
      refMap.clear()
    }
  }, [map])

  return null
}
