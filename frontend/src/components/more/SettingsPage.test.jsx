/**
 * SettingsPage — "홈 상단" 세그먼트(heroStyle) 테스트.
 *
 * 이 컴포넌트는 selector가 많아 전체를 모킹하기보다(useFavorites.test.js와
 * 동일 전략) 실제 useAppStore를 그대로 쓰고 beforeEach에서 상태만 초기화한다.
 * "노선 알림" useEffect가 참조하는 push API는 jsdom에 navigator.serviceWorker /
 * PushManager가 없어 isPushSupported()가 false로 안전하게 종료된다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import SettingsPage from './SettingsPage'
import useAppStore from '../../stores/useAppStore'

beforeEach(() => {
  useAppStore.setState({ heroStyle: 'greeting' })
})

describe('SettingsPage — 홈 상단(heroStyle)', () => {
  it('기본값 greeting이면 "감성 인사"가 선택된 상태로 렌더된다', () => {
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)
    expect(screen.getByRole('button', { name: '감성 인사' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '날씨 위주' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('"날씨 위주"를 클릭하면 useAppStore.heroStyle이 classic으로 반영된다', () => {
    render(<SettingsPage embedded onOpenAppInfo={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '날씨 위주' }))
    expect(useAppStore.getState().heroStyle).toBe('classic')
    expect(screen.getByRole('button', { name: '날씨 위주' })).toHaveAttribute('aria-pressed', 'true')
  })
})
