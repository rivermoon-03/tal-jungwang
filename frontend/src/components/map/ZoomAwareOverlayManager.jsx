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
 */

import { useEffect, useRef } from 'react'
import { createMarkerChipElement, createSubwayMultiChipElement } from './MarkerChip'
import { createMarkerDotElement } from './MarkerDot'

// 줌 임계값: 이 값 이하이면 Chip 표시
const CHIP_ZOOM_THRESHOLD = 6

export default function ZoomAwareOverlayManager({ map, stations = [], onTap }) {
  // overlayRefs: [{ overlay: CustomOverlay, station, mode: 'chip'|'dot' }]
  const overlaysRef = useRef([])

  useEffect(() => {
    if (!map || !window.kakao?.maps || !stations.length) return

    // 오버레이 생성 헬퍼
    function makeOverlay(station, mode) {
      const pos = new window.kakao.maps.LatLng(station.lat, station.lng)
      const content = mode === 'chip'
        ? (station.chipVariant === 'subwayMulti'
            ? createSubwayMultiChipElement({
                subwayData: station.subwayData,
                onClick: () => onTap?.(station),
              })
            : createMarkerChipElement({
                routeCode:   station.routeCode,
                routeColor:  station.routeColor,
                stationName: station.name,
                liveMinutes: station.liveMinutes ?? null,
                showLive:    station.showLive ?? false,
                inaccurate:  station.liveInaccurate ?? false,
                badgeText:   station.badgeText,
                extraPillText: station.extraPillText ?? null,
                subLabel:    station.subLabel ?? null,
                onClick: () => onTap?.(station),
              }))
        : createMarkerDotElement({
            type:        station.type,
            customColor: station.routeColor,
            onClick: () => onTap?.(station),
          })

      const overlay = new window.kakao.maps.CustomOverlay({
        position: pos,
        content,
        xAnchor: 0.5,
        yAnchor: 1.0,
        zIndex: 4,
      })
      overlay.setMap(map)
      return overlay
    }

    // 현재 줌 레벨에 맞는 mode 결정
    const initialLevel = map.getLevel()
    const initialMode = initialLevel <= CHIP_ZOOM_THRESHOLD ? 'chip' : 'dot'

    // 오버레이 초기 생성
    const instances = stations.map((station) => {
      const overlay = makeOverlay(station, initialMode)
      return { overlay, station, mode: initialMode }
    })
    overlaysRef.current = instances

    // zoom_changed 리스너 등록
    function handleZoomChange() {
      const level = map.getLevel()
      const newMode = level <= CHIP_ZOOM_THRESHOLD ? 'chip' : 'dot'

      overlaysRef.current.forEach((item) => {
        if (item.mode === newMode) return  // 변경 불필요

        // 기존 오버레이 제거 후 새 콘텐츠로 교체
        item.overlay.setMap(null)

        const newContent = newMode === 'chip'
          ? (item.station.chipVariant === 'subwayMulti'
              ? createSubwayMultiChipElement({
                  subwayData: item.station.subwayData,
                  onClick: () => onTap?.(item.station),
                })
              : createMarkerChipElement({
                  routeCode:   item.station.routeCode,
                  routeColor:  item.station.routeColor,
                  stationName: item.station.name,
                  liveMinutes: item.station.liveMinutes ?? null,
                  showLive:    item.station.showLive ?? false,
                  inaccurate:  item.station.liveInaccurate ?? false,
                  badgeText:   item.station.badgeText,
                  extraPillText: item.station.extraPillText ?? null,
                  subLabel:    item.station.subLabel ?? null,
                  onClick: () => onTap?.(item.station),
                }))
          : createMarkerDotElement({
              type:        item.station.type,
              customColor: item.station.routeColor,
              onClick: () => onTap?.(item.station),
            })

        const pos = new window.kakao.maps.LatLng(item.station.lat, item.station.lng)
        const newOverlay = new window.kakao.maps.CustomOverlay({
          position: pos,
          content:  newContent,
          xAnchor:  0.5,
          yAnchor:  1.0,
          zIndex:   4,
        })
        newOverlay.setMap(map)

        item.overlay = newOverlay
        item.mode    = newMode
      })
    }

    window.kakao.maps.event.addListener(map, 'zoom_changed', handleZoomChange)

    return () => {
      window.kakao.maps.event.removeListener(map, 'zoom_changed', handleZoomChange)
      overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null))
      overlaysRef.current = []
    }
  }, [map, stations, onTap])

  return null
}
