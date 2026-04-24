import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import useFavorites from './useFavorites'
import useAppStore from '../stores/useAppStore'

beforeEach(() => {
  useAppStore.setState({ favorites: { routes: [], stations: [] } })
})

describe('useFavorites', () => {
  it('adds then removes on toggle', () => {
    const { result } = renderHook(() => useFavorites('20-1'))
    expect(result.current.isFavorite).toBe(false)
    act(() => result.current.toggle({ type: 'bus', label: '20-1' }))
    expect(useAppStore.getState().favorites.routes).toContain('20-1')
    act(() => result.current.toggle({ type: 'bus', label: '20-1' }))
    expect(useAppStore.getState().favorites.routes).not.toContain('20-1')
  })

  it('no-op when key is falsy', () => {
    const { result } = renderHook(() => useFavorites(''))
    act(() => result.current.toggle({ type: 'bus', label: 'x' }))
    expect(useAppStore.getState().favorites.routes).toHaveLength(0)
  })

  it('reflects subway key storage', () => {
    const subwayKey = 'subway:정왕:up'
    const { result } = renderHook(() => useFavorites(subwayKey))
    act(() => result.current.toggle({ type: 'subway', label: '수인분당선 상행' }))
    expect(useAppStore.getState().favorites.routes).toContain(subwayKey)
    expect(result.current.isFavorite).toBe(true)
  })
})
