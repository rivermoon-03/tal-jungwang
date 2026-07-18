import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import useEffectiveDirection from './useEffectiveDirection'
import useAppStore from '../stores/useAppStore'
import { DEFAULT_CENTER, SECOND_CAMPUS_CENTER } from './useShuttle'

// KST = UTC+9. UTC 시각을 넣어 KST 경계값을 검증한다(timeOfDay.test.js와 동일 패턴).
function utc(dateStr) {
  return new Date(dateStr)
}

beforeEach(() => {
  useAppStore.setState({
    directionOverride: null,
    commuteAutoMode: true,
    commuteManualDirection: '등교',
    userLocation: null,
  })
})

describe('useEffectiveDirection — KST 시간 경계', () => {
  it('KST 13:59는 등교', () => {
    // KST 13:59 == UTC 04:59
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T04:59:00Z')))
    expect(result.current).toEqual({ direction: '등교', isOverride: false })
  })

  it('KST 14:00은 하교', () => {
    // KST 14:00 == UTC 05:00
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T05:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: false })
  })

  it('KST 자정(00:00) 직후는 등교(자정 넘김 케이스)', () => {
    // KST 00:00 == UTC 전날 15:00
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-16T15:00:00Z')))
    expect(result.current).toEqual({ direction: '등교', isOverride: false })
  })

  it('KST 23:59는 하교', () => {
    // KST 23:59 == UTC 14:59
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T14:59:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: false })
  })
})

describe('useEffectiveDirection — 우선순위', () => {
  it('directionOverride가 있으면 시간/위치보다 최우선', () => {
    useAppStore.setState({ directionOverride: '하교' })
    // 시간상으로는 등교(오전)여야 하지만 override가 이긴다.
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T00:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: true })
  })

  it('commuteAutoMode=false면 commuteManualDirection 고정값을 반환한다', () => {
    useAppStore.setState({ commuteAutoMode: false, commuteManualDirection: '하교' })
    // 시간상으로는 등교(오전)여야 하지만 수동 모드가 이긴다.
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T00:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: true })
  })
})

describe('useEffectiveDirection — 위치 기반 보강', () => {
  it('본캠 근처에 있으면(등교 시간대라도) 하교로 보강한다', () => {
    useAppStore.setState({ userLocation: { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng } })
    // KST 09:00 == UTC 00:00 → 시간만으로는 등교
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T00:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: false })
  })

  it('2캠 근처에 있어도 하교로 보강한다', () => {
    useAppStore.setState({
      userLocation: { lat: SECOND_CAMPUS_CENTER.lat, lng: SECOND_CAMPUS_CENTER.lng },
    })
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T00:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: false })
  })

  it('서울(캠퍼스에서 멀리)에 있으면(하교 시간대라도) 등교로 보강한다', () => {
    useAppStore.setState({ userLocation: { lat: 37.5665, lng: 126.9780 } })
    // KST 20:00 == UTC 11:00 → 시간만으로는 하교
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T11:00:00Z')))
    expect(result.current).toEqual({ direction: '등교', isOverride: false })
  })

  it('userLocation이 null이면 위치 로직을 건너뛰고 시간 기반값을 쓴다', () => {
    useAppStore.setState({ userLocation: null })
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T11:00:00Z')))
    expect(result.current).toEqual({ direction: '하교', isOverride: false })
  })

  it('캠퍼스와 애매한 거리(근접도 이탈도 아님)면 시간 기반값으로 폴백한다', () => {
    // 본캠에서 약 2.7km 떨어진 지점(NEAR 1500m 초과, FAR 5000m 미만) — 애매 구간
    useAppStore.setState({ userLocation: { lat: 37.3650, lng: 126.7335 } })
    // KST 09:00 == UTC 00:00 → 시간 기반이면 등교
    const { result } = renderHook(() => useEffectiveDirection(utc('2026-07-17T00:00:00Z')))
    expect(result.current).toEqual({ direction: '등교', isOverride: false })
  })
})
