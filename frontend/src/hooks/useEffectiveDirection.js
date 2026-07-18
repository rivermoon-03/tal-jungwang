import useAppStore from '../stores/useAppStore'
import { getKstHour } from '../utils/timeOfDay'
import { DEFAULT_CENTER, SECOND_CAMPUS_CENTER } from './useShuttle'

// 캠퍼스 근접 판정 반경(m). 본캠·2캠은 haversine 기준 약 4.2km 떨어져 있어
// (DEFAULT_CENTER 37.3400,126.7335 ↔ SECOND_CAMPUS_CENTER 37.327877,126.688509),
// 아래 두 반경을 겹치지 않게 잡아 "근접"과 "이탈" 판정이 서로 모순되지 않게 한다.
// - NEAR 이내: 두 캠퍼스 중 하나 안에 있다 → 이미 등교 완료 상태로 보고 '하교'가 유효할 가능성이 높다.
// - FAR 이상: 두 캠퍼스 모두에서 멀리 떨어져 있다(정왕역·시흥·서울 방향) → '등교'가 유효할 가능성이 높다.
// - 그 사이(애매한 구간)는 위치로 단정하지 않고 시간 기반 판정에 맡긴다.
const NEAR_CAMPUS_RADIUS_M = 1500
const FAR_FROM_CAMPUS_RADIUS_M = 5000

/**
 * 두 WGS84 좌표 간 거리(m)를 haversine 공식으로 계산한다.
 *
 * useUserLocation.js에 동일한 계산(distanceMeters)이 있지만 export되어 있지 않고,
 * 이 훅은 작업 범위상 지정된 파일만 수정하도록 제한돼 있어 로컬로 유지한다.
 * 이후 두 곳 이상에서 재사용이 필요해지면 공용 geo 헬퍼로 승격한다.
 */
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * 사용자 위치로 방향을 역추론한다. 애매하면(캠퍼스와 너무 가깝지도 멀지도 않으면)
 * null을 반환해 시간 기반 판정으로 폴백하게 한다.
 * @param {{lat:number, lng:number}|null} userLocation
 * @returns {'등교'|'하교'|null}
 */
function inferDirectionFromLocation(userLocation) {
  if (!userLocation || userLocation.lat == null || userLocation.lng == null) return null
  const { lat, lng } = userLocation
  const distMain = distanceMeters(lat, lng, DEFAULT_CENTER.lat, DEFAULT_CENTER.lng)
  const distCampus2 = distanceMeters(lat, lng, SECOND_CAMPUS_CENTER.lat, SECOND_CAMPUS_CENTER.lng)
  const nearestCampusDist = Math.min(distMain, distCampus2)
  if (nearestCampusDist <= NEAR_CAMPUS_RADIUS_M) return '하교'
  if (nearestCampusDist >= FAR_FROM_CAMPUS_RADIUS_M) return '등교'
  return null
}

/**
 * useEffectiveDirection — 현재 유효한 버스 방향(등교/하교)을 반환.
 *
 * 우선순위:
 *   1. `directionOverride` (Zustand in-memory, 세션 전용 퀵토글) — 있으면 항상 최우선.
 *   2. `commuteAutoMode === false` (설정 화면에서 수동 지정, persist) — `commuteManualDirection` 고정 반환.
 *   3. 자동 판정 = KST 시간 기반 기본값을, 위치가 애매하지 않을 때만 위치 기반 판정으로 덮어씀.
 *      - KST 14시를 경계로 자동 전환 (자정~13시 → '등교', 14시~23시 → '하교').
 *        `new Date().getHours()`(브라우저 로컬 시각) 대신 `getKstHour()`로 KST를 명시한다
 *        (CLAUDE.md 철칙: 시각은 항상 timezone-aware하게 비교).
 *      - `userLocation`(useAppStore)이 있고 캠퍼스에 아주 가깝거나 아주 멀 때만 시간 기반값을 덮어쓴다.
 *        `userLocation`이 null(GPS 미허용)이거나 애매한 거리면 시간 기반값을 그대로 쓴다.
 *
 * 반환 shape:
 *   { direction: '등교' | '하교', isOverride: boolean }
 *   isOverride는 "자동 알고리즘이 아니라 사용자가 명시적으로 정한 값"일 때 true
 *   (directionOverride 또는 수동 모드 고정값). 시간/위치 자동 판정일 때는 false.
 *
 * @param {Date} [now] 테스트용 주입 시각. 기본값은 호출 시점의 현재 시각.
 */
export default function useEffectiveDirection(now = new Date()) {
  const override = useAppStore((s) => s.directionOverride)
  const commuteAutoMode = useAppStore((s) => s.commuteAutoMode)
  const commuteManualDirection = useAppStore((s) => s.commuteManualDirection)
  const userLocation = useAppStore((s) => s.userLocation)

  if (override) return { direction: override, isOverride: true }

  if (!commuteAutoMode) {
    return { direction: commuteManualDirection ?? '등교', isOverride: true }
  }

  const timeDirection = getKstHour(now) < 14 ? '등교' : '하교'
  const locationDirection = inferDirectionFromLocation(userLocation)
  return { direction: locationDirection ?? timeDirection, isOverride: false }
}
