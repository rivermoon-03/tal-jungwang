import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const { stub } = vi.hoisted(() => ({
  stub: (id) => ({ default: (props) => <div data-testid={id} data-props={JSON.stringify(props)} /> }),
}))
vi.mock('./components/home/HomePage', () => stub('home'))
vi.mock('./components/transit/TransitPage', () => stub('transit'))
vi.mock('./components/transit/BusRoutePage', () => stub('bus-route'))
vi.mock('./components/transit/TimetablePages', () => ({
  SubwayTimetablePage: (p) => <div data-testid="subway-tt" data-props={JSON.stringify(p)} />,
  ShuttleTimetablePage: (p) => <div data-testid="shuttle-tt" data-props={JSON.stringify(p)} />,
}))
vi.mock('./components/meal/SchoolFoodPage', () => stub('meal'))
vi.mock('./components/meal/MealVenuePage', () => stub('venue'))
vi.mock('./pages/MorePage', () => stub('more'))
vi.mock('./pages/NoticesTabPage', () => stub('notices'))
vi.mock('./pages/PrivacyPage', () => stub('privacy'))
vi.mock('./components/layout/PWAInstallBanner', () => ({ default: () => null }))
vi.mock('./components/shell/AppShell', () => ({ default: ({ children }) => <div>{children}</div> }))

import App from './App'

function open(path) {
  window.history.replaceState({}, '', path)
  render(<App />)
}
const props = (id) => JSON.parse(screen.getByTestId(id).dataset.props)

describe('App 라우팅', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  it.each([
    ['/', 'home'],
    ['/transit', 'transit'],
    ['/cafeteria', 'meal'],
    ['/more', 'more'],
    ['/more/settings', 'more'],
    ['/notices', 'notices'],
    ['/privacy', 'privacy'],
  ])('%s → %s', (path, id) => {
    open(path)
    expect(screen.getByTestId(id)).toBeInTheDocument()
  })

  it('버스 노선 상세에 노선, 정류장, 보기를 넘긴다', () => {
    open(`/transit/bus/${encodeURIComponent('시흥33')}?stop=224000639&view=history`)
    expect(props('bus-route')).toEqual({ route: '시흥33', stop: '224000639', view: 'history' })
  })

  it('시간표 화면에 방면 키와 방향을 넘긴다', () => {
    open('/transit/subway/timetable?key=line4_up')
    expect(props('subway-tt')).toEqual({ dirKey: 'line4_up' })
  })

  it('식당 상세에 디코딩한 id 를 넘긴다', () => {
    open('/cafeteria/student-cafeteria')
    expect(props('venue')).toEqual({ venueId: 'student-cafeteria' })
  })

  it.each([
    ['/schedule', 'transit', '/transit'],
    ['/route/bus:33', 'transit', '/transit'],
    ['/facilities?tab=diet', 'meal', '/cafeteria'],
    ['/favorites', 'home', '/'],
  ])('옛 주소 %s 는 새 화면으로 바꾼다', (path, id, to) => {
    open(path)
    expect(screen.getByTestId(id)).toBeInTheDocument()
    expect(window.location.pathname).toBe(to)
  })
})
