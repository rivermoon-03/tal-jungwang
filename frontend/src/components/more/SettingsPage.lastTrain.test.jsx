/**
 * SettingsPage — "막차 알림"(B1) 토글·리드타임 칩 테스트.
 *
 * SettingsPage.test.jsx(heroStyle)는 jsdom의 push 미지원 폴백에 기대지만,
 * 여기서는 실제 토글/구독 플로우를 검증해야 하므로 utils/pushNotifications를
 * 모킹해 "권한 granted + 구독 존재" 환경을 흉내낸다. store는 실제
 * useAppStore를 쓰고 beforeEach에서 상태만 초기화한다.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../utils/pushNotifications', () => ({
  isPushSupported: () => true,
  getNotificationPermission: () => 'granted',
  hasActivePushSubscription: vi.fn(async () => true),
  subscribeToPush: vi.fn(async () => ({ ok: true })),
  unsubscribeFromPush: vi.fn(async () => ({ ok: true })),
  syncPushFavorites: vi.fn(async () => ({ ok: true })),
  syncPushPreferences: vi.fn(async () => ({ ok: true })),
}))

import SettingsPage from './SettingsPage'
import useAppStore from '../../stores/useAppStore'
import {
  hasActivePushSubscription,
  subscribeToPush,
  syncPushPreferences,
} from '../../utils/pushNotifications'

beforeEach(() => {
  vi.clearAllMocks()
  hasActivePushSubscription.mockImplementation(async () => true)
  useAppStore.setState({
    lastTrainAlert: { enabled: false, leadMin: 30 },
    favorites: { routes: [], stations: [], venues: [], keys: [] },
  })
})

describe('SettingsPage — 막차 알림(B1)', () => {
  it('막차 알림 행이 스위치·설명과 함께 렌더된다', async () => {
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)

    expect(screen.getByText('막차 알림')).toBeInTheDocument()
    expect(screen.getByText('정왕역 기준 · 매일')).toBeInTheDocument()
    const toggle = screen.getByRole('switch', { name: '막차 알림' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    // 꺼진 상태에서는 리드타임 칩이 보이지 않는다
    expect(screen.queryByRole('button', { name: '30분 전' })).toBeNull()
    // mount effect(구독 확인)가 렌더 뒤에 끝나도록 대기 — act 경고 방지
    await waitFor(() => expect(hasActivePushSubscription).toHaveBeenCalled())
  })

  it('구독이 있으면 토글 시 서버 프리퍼런스를 동기화하고 칩(기본 30분)이 나타난다', async () => {
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)

    fireEvent.click(screen.getByRole('switch', { name: '막차 알림' }))

    await waitFor(() =>
      expect(useAppStore.getState().lastTrainAlert.enabled).toBe(true)
    )
    expect(syncPushPreferences).toHaveBeenCalledWith({
      last_train: { enabled: true, lead_min: 30 },
    })
    expect(subscribeToPush).not.toHaveBeenCalled()

    const chip30 = await screen.findByRole('button', { name: '30분 전' })
    expect(chip30).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1시간 전' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '15분 전' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('구독이 없으면 노선 알림과 같은 구독 플로우(subscribeToPush)를 재사용한다', async () => {
    hasActivePushSubscription.mockImplementation(async () => false)
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)

    fireEvent.click(screen.getByRole('switch', { name: '막차 알림' }))

    await waitFor(() =>
      expect(useAppStore.getState().lastTrainAlert.enabled).toBe(true)
    )
    expect(subscribeToPush).toHaveBeenCalledWith([], {
      last_train: { enabled: true, lead_min: 30 },
    })
  })

  it('리드타임 칩을 누르면 leadMin이 갱신되고 서버에도 반영된다', async () => {
    useAppStore.setState({ lastTrainAlert: { enabled: true, leadMin: 30 } })
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: '15분 전' }))

    expect(useAppStore.getState().lastTrainAlert.leadMin).toBe(15)
    await waitFor(() =>
      expect(syncPushPreferences).toHaveBeenCalledWith({
        last_train: { enabled: true, lead_min: 15 },
      })
    )
    expect(screen.getByRole('button', { name: '15분 전' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('구독이 사라졌으면 mount 시 켜짐 상태를 꺼짐으로 되돌린다', async () => {
    hasActivePushSubscription.mockImplementation(async () => false)
    useAppStore.setState({ lastTrainAlert: { enabled: true, leadMin: 30 } })
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)

    await waitFor(() =>
      expect(useAppStore.getState().lastTrainAlert.enabled).toBe(false)
    )
  })
})
