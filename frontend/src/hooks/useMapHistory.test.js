/**
 * useMapHistory — 뒤로가기가 전체화면 지도를 닫는다.
 *
 * 예전엔 지도를 편 채 뒤로가기를 누르면 주소 해시만 바뀌고 지도는 그대로였다
 * (실측: #map → #main 으로 바뀌는데 닫기 버튼이 그대로 남아 있었다).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMapHistory, isMapHistoryEntry } from './useMapHistory'

describe('useMapHistory', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('지도를 펼치면 같은 주소로 mapExpanded 항목을 하나 쌓는다', () => {
    const setMapExpanded = vi.fn()
    const push = vi.spyOn(window.history, 'pushState')
    renderHook(() => useMapHistory(true, setMapExpanded))
    expect(push).toHaveBeenCalledTimes(1)
    expect(isMapHistoryEntry()).toBe(true)
    expect(window.location.pathname).toBe('/')
    push.mockRestore()
  })

  it('이미 지도 항목 위에 있으면 다시 쌓지 않는다', () => {
    window.history.replaceState({ mapExpanded: true }, '', '/')
    const push = vi.spyOn(window.history, 'pushState')
    renderHook(() => useMapHistory(true, vi.fn()))
    expect(push).not.toHaveBeenCalled()
    push.mockRestore()
  })

  it('popstate 로 지도 항목이 사라지면 지도를 접는다', () => {
    const setMapExpanded = vi.fn()
    renderHook(() => useMapHistory(true, setMapExpanded))
    // 뒤로가기: 이전 항목(state 없음)으로 돌아온 상황을 흉내 낸다.
    window.history.replaceState({}, '', '/')
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(setMapExpanded).toHaveBeenCalledWith(false)
  })

  it('popstate 뒤에도 지도 항목 위에 있으면 지도를 접지 않는다', () => {
    const setMapExpanded = vi.fn()
    renderHook(() => useMapHistory(true, setMapExpanded))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(setMapExpanded).not.toHaveBeenCalled()
  })
})
