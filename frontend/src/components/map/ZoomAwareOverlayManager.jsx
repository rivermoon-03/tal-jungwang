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
 */

import { useEffect, useRef } from 'react'
import { createMarkerChipElement, createSubwayMultiChipElement, createSeohaeSiheungChipElement } from './MarkerChip'
import { createMarkerDotElement } from './MarkerDot'

// 줌 임계값: 이 값 이하이면 Chip 표시
const CHIP_ZOOM_THRESHOLD = 6

// chip 콘텐츠에 영향을 주는 라이브/표시 필드만 모은 시그니처.
// 이 값이 같으면 mode/위치 변화가 없는 한 콘텐츠 재생성 불필요.
function contentSignature(s) {
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

    function buildContent(station, mode) {
      return mode === 'chip'
        ? buildChipContent(station)
        : createMarkerDotElement({
            type:        station.type,
            customColor: station.routeColor,
            onClick: () => handleTap(station),
          })
    }

    // 현재 줌 레벨에 맞는 mode 결정
    const modeForLevel = (level) => (level <= CHIP_ZOOM_THRESHOLD ? 'chip' : 'dot')
    const currentMode = modeForLevel(map.getLevel())

    // ── diff: id 집합 + 라이브 값 변화를 한 번에 처리 ──
    const refMap = overlaysRef.current
    const nextIds = new Set()

    for (const station of stations) {
      nextIds.add(station.id)
      const sig = contentSignature(station)
      const existing = refMap.get(station.id)

      if (!existing) {
        // 새 마커 → overlay 생성
        const pos = new window.kakao.maps.LatLng(station.lat, station.lng)
        const overlay = new window.kakao.maps.CustomOverlay({
          position: pos,
          content:  buildContent(station, currentMode),
          xAnchor:  0.5,
          yAnchor:  1.0,
          zIndex:   4,
        })
        overlay.setMap(map)
        refMap.set(station.id, { overlay, station, mode: currentMode, sig })
        continue
      }

      // 위치 변경 여부 (마커 위치는 거의 불변)
      const moved = existing.station.lat !== station.lat || existing.station.lng !== station.lng
      const contentChanged = existing.sig !== sig || existing.mode !== currentMode

      // station 참조 최신화 (onTap 콜백이 최신 데이터를 닫도록)
      existing.station = station

      if (moved) {
        existing.overlay.setPosition(new window.kakao.maps.LatLng(station.lat, station.lng))
      }

      if (contentChanged) {
        // overlay는 파괴하지 않고 콘텐츠만 교체 → 지도 레이어 reflow 없음
        existing.overlay.setContent(buildContent(station, currentMode))
        existing.mode = currentMode
        existing.sig  = sig
      }
    }

    // 사라진 마커 제거
    for (const [id, item] of refMap) {
      if (!nextIds.has(id)) {
        item.overlay.setMap(null)
        refMap.delete(id)
      }
    }

    // ── zoom_changed: mode(chip↔dot)만 in-place 갱신 ──
    function handleZoomChange() {
      const newMode = modeForLevel(map.getLevel())
      for (const item of refMap.values()) {
        if (item.mode === newMode) continue
        item.overlay.setContent(buildContent(item.station, newMode))
        item.mode = newMode
      }
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
