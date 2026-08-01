/**
 * SchedulePage — 즐겨찾기 필터 회귀 테스트 (결함 #20).
 *
 * 버그: 별 저장은 route_number("20-1") 또는 "${busGroup}:${routeNo}" 같은 레거시
 * 형태로 여기저기 흩어져 있었는데, "★ 즐겨찾기" 필터는 favCode("하교:20-1") 문자열과
 * 정확히 일치하는지만 봐서 실제로 별을 눌러도 필터에는 항상 "즐겨찾기한 노선이
 * 없어요"가 떴다. 이 테스트는 신규 favKey(utils/favKey.js) 저장값과 레거시
 * 저장값(순수 route_number) 양쪽 모두 필터가 인식하는지 검증한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import SchedulePage from './SchedulePage'
import { makeFavKey } from '../../utils/favKey'

const ROUTES = [
  {
    route_id: 1,
    route_number: '20-1',
    route_name: '시흥20-1번',
    direction_name: '아이파크아파트방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 10, name: '한국공학대학교', lat: 37.3, lng: 126.7 }],
  },
  {
    route_id: 2,
    route_number: '3400',
    route_name: null,
    direction_name: '서울행',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 11, name: '시화터미널', lat: 37.34, lng: 126.73 }],
  },
  {
    route_id: 3,
    route_number: '5200',
    route_name: '시흥5200번',
    direction_name: '신도림역방면',
    category: '하교',
    is_realtime: true,
    stops: [{ stop_id: 12, name: '시화터미널', lat: 37.34, lng: 126.73 }],
  },
]

vi.mock('../../hooks/useBus', () => ({
  useBusRoutesByCategory: () => ({ data: ROUTES, loading: false }),
  useBusTimetable: () => ({ data: null, loading: false }),
  useBusTimetableByRoute: () => ({ data: null, loading: false }),
  useBusArrivals: () => ({ data: null, loading: false }),
  useBusHistoryPreview: () => ({ data: null, loading: false }),
  useBusArrivalStats: () => ({ data: null, loading: false }),
}))

vi.mock('../../hooks/useMapMarkers', () => ({
  useMapMarkers: () => ({ data: { markers: [] }, loading: false }),
}))

// 20-1(route_id=1)은 신규 favKey 스키마로, 3400은 레거시 순수 route_number("3400")로
// 저장된 상황을 재현한다. 5200은 즐겨찾기하지 않았다.
const favKeyFor20_1 = makeFavKey({ mode: 'bus', id: 1, direction: '하교' })

let favoritesState = { routes: ['3400'], stations: [], venues: [], keys: [favKeyFor20_1] }
const toggleFavoriteKey = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      selectedMode: 'bus',
      setSelectedMode: vi.fn(),
      selectedShuttleCampus: 'main',
      setShuttleCampus: vi.fn(),
      scheduleHint: null,
      setScheduleHint: vi.fn(),
      favorites: favoritesState,
      toggleFavoriteKey,
      setMapPanTarget: vi.fn(),
      setSubwayDetailSheet: vi.fn(),
      scheduleViewMode: 'list',
      setScheduleViewMode: vi.fn(),
    }),
}))

describe('SchedulePage — 즐겨찾기 필터(결함 #20 회귀)', () => {
  it('필터를 켜면 신규(favKey)+레거시(route_number) 저장값 모두 인식해 즐겨찾기한 노선만 보인다', () => {
    render(<SchedulePage />)

    // 필터 켜기 전: 세 노선 모두 보인다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5200').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByLabelText('즐겨찾기한 노선만 보기'))

    // 필터 켠 후: 20-1(신규 favKey)·3400(레거시 route_number)은 남고, 5200은 사라진다.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)
    expect(screen.queryByText('5200')).not.toBeInTheDocument()
  })
})

// ─── PC master-detail (결함 #19/#33) ────────────────────────────────────────
// 데스크톱에서 버스 행을 클릭하면 예전에는 components/bus/BusArrivalCard가 자체
// pushState 네비게이트를 실행해 전체 페이지(/route/bus:번호)로 이동, 좌측 목록이
// 사라졌다. 리디자인 후에는 라우팅 없이 우측 인라인 패널에서 렌더돼야 한다.
function stubMatchMedia(matches) {
  window.matchMedia = vi.fn((query) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
}

describe('SchedulePage — PC master-detail(결함 #19/#33 회귀)', () => {
  it('데스크톱에서 버스 행을 클릭하면 라우팅 이동 없이 우측 패널에 렌더된다(좌측 목록 유지)', () => {
    stubMatchMedia(true)
    const pushStateSpy = vi.spyOn(window.history, 'pushState')

    render(<SchedulePage />)

    // 좌측 목록(노선 리스트)이 여전히 보여야 한다 — 클릭 전 확인.
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByText('20-1')[0])

    // 라우팅 이동(/route/bus:20-1) 없음 — pushState가 호출되지 않았다.
    expect(pushStateSpy).not.toHaveBeenCalled()
    // 좌측 목록이 그대로 남아있다(전체 페이지 이동으로 사라지지 않음).
    expect(screen.getAllByText('20-1').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3400').length).toBeGreaterThan(0)

    pushStateSpy.mockRestore()
    stubMatchMedia(false)
  })
})
