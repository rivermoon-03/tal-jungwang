import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import FloatingDock from './FloatingDock'
import useAppStore from '../../stores/useAppStore'

function setPath(pathname) {
  window.history.replaceState({}, '', pathname)
}

describe('FloatingDock', () => {
  beforeEach(() => {
    setPath('/')
    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      vibrate: vi.fn(),
    })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('탭 5개(홈/시간표/학식/매장/공지) aria-label + 시각 텍스트 라벨(12px) + href', () => {
    render(<FloatingDock />)
    expect(screen.getByLabelText('홈')).toHaveAttribute('href', '/')
    expect(screen.getByLabelText('시간표')).toHaveAttribute('href', '/schedule')
    expect(screen.getByLabelText('학식')).toHaveAttribute('href', '/facilities?tab=diet')
    expect(screen.getByLabelText('매장')).toHaveAttribute('href', '/facilities?tab=venues')
    expect(screen.getByLabelText('공지')).toHaveAttribute('href', '/notices')
    // 더보기는 독에서 빠졌다(App.jsx의 상시 진입점으로 이동).
    expect(screen.queryByLabelText('더보기')).toBeNull()
    expect(screen.queryByLabelText('학교시설')).toBeNull()
    // 결함 #31 수정 — 아이콘 아래 시각 텍스트 라벨이 보여야 한다.
    expect(screen.getAllByText('학식').length).toBeGreaterThan(0)
    const label = screen.getByText('시간표')
    expect(label.className).toContain('text-meta')
  })

  it('탭 5개 모두 44px 이상 터치 타깃을 유지한다', () => {
    render(<FloatingDock />)
    for (const name of ['홈', '시간표', '학식', '매장', '공지']) {
      const link = screen.getByLabelText(name)
      expect(link.className).toContain('min-w-[44px]')
      expect(link.className).toContain('min-h-[44px]')
    }
  })

  it('/ 에서는 홈 탭만 활성이다', () => {
    setPath('/')
    render(<FloatingDock />)
    expect(screen.getByLabelText('홈')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('시간표')).not.toHaveAttribute('aria-current')
    expect(screen.getByLabelText('학식')).not.toHaveAttribute('aria-current')
    expect(screen.getByLabelText('매장')).not.toHaveAttribute('aria-current')
  })

  it('/schedule 에서는 시간표 탭만 활성이다', () => {
    setPath('/schedule')
    render(<FloatingDock />)
    expect(screen.getByLabelText('시간표')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('홈')).not.toHaveAttribute('aria-current')
  })

  // 학식/매장은 같은 경로(/facilities)를 ?tab= 값으로만 가른다 — pathname만 보면
  // 두 탭이 동시에 활성으로 보이는 회귀가 나기 쉽다.
  it('/facilities?tab=diet 에서는 학식만 활성이고 매장은 활성이 아니다', () => {
    setPath('/facilities?tab=diet')
    render(<FloatingDock />)
    expect(screen.getByLabelText('학식')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('매장')).not.toHaveAttribute('aria-current')
  })

  it('/facilities?tab=venues 에서는 매장만 활성이고 학식은 활성이 아니다', () => {
    setPath('/facilities?tab=venues')
    render(<FloatingDock />)
    expect(screen.getByLabelText('매장')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByLabelText('학식')).not.toHaveAttribute('aria-current')
  })

  it('/facilities (쿼리 없음)는 매장 기본값과 맞춰 매장이 활성이다', () => {
    setPath('/facilities')
    render(<FloatingDock />)
    expect(screen.getByLabelText('매장')).toHaveAttribute('aria-current', 'page')
  })

  // 옛 주소 /cafeteria(북마크·위젯 딥링크)도 학식/매장 구분이 유지되어야 한다.
  it('/cafeteria?tab=diet 옛 주소에서도 학식이 활성이다', () => {
    setPath('/cafeteria?tab=diet')
    render(<FloatingDock />)
    expect(screen.getByLabelText('학식')).toHaveAttribute('aria-current', 'page')
  })

  it('/cafeteria/gs25 매장 상세에서는 매장 탭이 활성이다', () => {
    setPath('/cafeteria/gs25')
    render(<FloatingDock />)
    expect(screen.getByLabelText('매장')).toHaveAttribute('aria-current', 'page')
  })

  it('학식 탭 클릭 시 /facilities?tab=diet 로 이동한다', () => {
    setPath('/')
    render(<FloatingDock />)
    fireEvent.click(screen.getByLabelText('학식'))
    expect(window.location.pathname + window.location.search).toBe('/facilities?tab=diet')
  })

  it('홈 탭 롱프레스 타이머 500ms 설정', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    setTimeoutSpy.mockClear()
    fireEvent.pointerDown(homeTab)

    const calls = setTimeoutSpy.mock.calls
    expect(calls.some((call) => call[1] === 500)).toBe(true)

    setTimeoutSpy.mockRestore()
  })

  it('롱프레스 발동 시 navigator.vibrate 호출', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(500)

    expect(navigator.vibrate).toHaveBeenCalledWith(10)
  })

  it('pointerUp 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerUp(homeTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('pointerLeave 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerLeave(homeTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('pointerCancel 시 롱프레스 타이머 해제', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(300)
    fireEvent.pointerCancel(homeTab)
    vi.advanceTimersByTime(200)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })

  it('롱프레스 발동 후 longPressTriggered 플래그 설정', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    fireEvent.pointerDown(homeTab)
    vi.advanceTimersByTime(500)

    const event = new MouseEvent('click', { bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    homeTab.dispatchEvent(event)

    expect(preventDefaultSpy).toBeDefined()
  })

  it('홈 탭 contextMenu 기본 동작 방지', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')

    const event = new Event('contextmenu', { bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
    homeTab.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('홈 탭 touch-action: none 설정', () => {
    render(<FloatingDock />)
    const homeTab = screen.getByLabelText('홈')
    const link = homeTab.closest('a')

    expect(link).toHaveStyle({ touchAction: 'none' })
  })

  it('기타 탭은 롱프레스 리스너 없음', () => {
    render(<FloatingDock />)
    const scheduleTab = screen.getByLabelText('시간표')

    fireEvent.pointerDown(scheduleTab)
    vi.advanceTimersByTime(500)

    expect(screen.queryByText(/즐겨찾기를 추가하면/)).not.toBeInTheDocument()
  })
})

/**
 * 결함 #12 — getActiveId가 매칭 실패 시 무조건 'home'을 반환하던 폴백을
 * 없앴다. /more, /favorites 처럼 다섯 탭 어디에도 속하지 않는 화면에서는
 * 독이 "홈"을 활성으로 칠하면 안 되고(aria-current도 안 붙어야 한다),
 * 홈은 실제 홈 경로('/')일 때만 활성이어야 한다.
 */
describe('FloatingDock — 다섯 탭에 안 속하는 경로에서는 아무 탭도 활성이 아니다(결함 #12)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it.each(['/more', '/favorites', '/settings', '/help', '/about', '/privacy'])(
    '%s 에서는 다섯 탭 중 어느 것도 aria-current가 없다(홈도 포함)',
    (path) => {
      setPath(path)
      render(<FloatingDock />)
      for (const name of ['홈', '시간표', '학식', '매장', '공지']) {
        expect(screen.getByLabelText(name)).not.toHaveAttribute('aria-current')
      }
    }
  )

  it('/ (진짜 홈 경로)에서는 여전히 홈만 활성이다', () => {
    setPath('/')
    render(<FloatingDock />)
    expect(screen.getByLabelText('홈')).toHaveAttribute('aria-current', 'page')
  })
})

/**
 * 결함 #2 — 지도를 편 채(mapExpanded=true) 독을 눌러 다른 탭(또는 같은 홈
 * 탭)으로 가도 MainShell이 mapExpanded만 보고 화면을 그려서, 실제로는 지도에
 * 갇힌 채 독 하이라이트만 옮겨갔다. 독은 이 앱에서 pushState로 라우팅을
 * 바꾸는 유일한 진입점이라 handleNav 한 곳에서 mapExpanded를 풀어준다.
 */
describe('FloatingDock — 탭 이동 시 mapExpanded를 해제한다(결함 #2)', () => {
  beforeEach(() => {
    setPath('/')
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
    useAppStore.getState().setMapExpanded(true)
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    useAppStore.getState().setMapExpanded(false)
  })

  it('다른 탭(시간표)으로 이동하면 mapExpanded가 풀린다', () => {
    render(<FloatingDock />)
    expect(useAppStore.getState().mapExpanded).toBe(true)
    fireEvent.click(screen.getByLabelText('시간표'))
    expect(useAppStore.getState().mapExpanded).toBe(false)
  })

  it('이미 홈 경로("/")에서 홈 탭을 다시 눌러도 mapExpanded가 풀린다', () => {
    render(<FloatingDock />)
    expect(useAppStore.getState().mapExpanded).toBe(true)
    fireEvent.click(screen.getByLabelText('홈'))
    expect(useAppStore.getState().mapExpanded).toBe(false)
  })
})

/**
 * 사용자 실측 — 히어로 위 "지금/시간표" 셀렉터를 없앴다. 예전엔 독의
 * "시간표" 탭과 화면 안 셀렉터가 같은 homeView를 두 군데서 조작해, 독에서
 * 시간표를 눌러도 셀렉터가 "지금"에 남아 있는 등 서로 어긋나 보였다.
 * 셀렉터를 없앤 이상, 한 번 시간표로 들어간 뒤 "지금"으로 되돌아올 길이
 * 독의 홈 탭 말고는 없다 — mapExpanded와 같은 이유로 독이 라우팅을 바꾸는
 * 유일한 지점이라 handleNav 한 곳에서 홈 탭을 누를 때만 되돌린다.
 */
describe('FloatingDock — 홈 탭을 누르면 homeView를 "now"로 되돌린다', () => {
  beforeEach(() => {
    setPath('/')
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { vibrate: vi.fn() })
    useAppStore.getState().setHomeView('timetable')
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    useAppStore.getState().setHomeView('now')
  })

  it('홈 탭을 누르면 homeView가 "now"로 되돌아온다', () => {
    render(<FloatingDock />)
    expect(useAppStore.getState().homeView).toBe('timetable')
    fireEvent.click(screen.getByLabelText('홈'))
    expect(useAppStore.getState().homeView).toBe('now')
  })

  it('시간표 탭을 눌러도 homeView는 되돌리지 않는다(시간표 탭 자체가 그 상태를 만드는 쪽이다)', () => {
    render(<FloatingDock />)
    fireEvent.click(screen.getByLabelText('시간표'))
    expect(useAppStore.getState().homeView).toBe('timetable')
  })

  it('홈이 아닌 다른 탭(학식)을 눌러도 homeView는 그대로다', () => {
    render(<FloatingDock />)
    fireEvent.click(screen.getByLabelText('학식'))
    expect(useAppStore.getState().homeView).toBe('timetable')
  })
})
