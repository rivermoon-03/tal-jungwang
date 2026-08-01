/**
 * FavoritesPage — 신규 favKey 스키마(favorites.keys) 마이그레이션 회귀 테스트.
 *
 * 배경: FavoritesPage는 그동안 legacy favorites.routes(순수 route_number,
 * "${busGroup}:${routeNo}", "subway:역:방향", "shuttle:방향" 등 화면마다 다른
 * 임시 형식)만 읽고 썼다. SchedulePage/RouteDetailPage는 이미 utils/favKey.js의
 * makeFavKey("${mode}:${id}:${direction}")로 통일된 favorites.keys를 쓰는데,
 * FavoritesPage는 그 배열을 아예 보지 않아 그쪽에서 새로 즐겨찾기한 노선이 여기엔
 * 나타나지 않았다. 이 테스트는 favorites.keys에 저장된 항목이 실제로 보이는지,
 * 그리고 별 해제가 올바른 스토어 액션(toggleFavoriteKey)으로 이어지는지 검증한다.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FavoritesPage from './FavoritesPage'
import { makeFavKey } from '../../utils/favKey'

// ScheduleDetailModal은 시간표/실시간/알림 등 훅 의존이 매우 깊어(결함과 무관),
// 이 테스트에서는 열림 여부만 확인하면 충분해 얕은 스텁으로 대체한다.
vi.mock('../schedule/ScheduleDetailModal', () => ({
  default: ({ open }) => (open ? <div data-testid="schedule-detail-modal" /> : null),
}))

vi.mock('../../hooks/useShuttle', () => ({
  useShuttleNext: () => ({ data: null }),
}))

vi.mock('../../hooks/useSubway', () => ({
  useSubwayNext: () => ({ data: null }),
}))

const HAGYO_ROUTES = [
  {
    route_id: 42,
    route_number: '77',
    route_name: '시흥77번',
    direction_name: '테스트행',
    is_realtime: false,
    stops: [{ stop_id: 5, name: '테스트정류장' }],
  },
]

vi.mock('../../hooks/useBus', () => ({
  useBusStations: () => ({ data: [] }),
  useBusRoutesByCategory: (category) => ({
    data: category === '하교' ? HAGYO_ROUTES : [],
    loading: false,
  }),
  useBusArrivals: () => ({ data: null }),
  useBusTimetable: () => ({ data: null }),
  useBusTimetableByRoute: () => ({ data: null }),
}))

const favKeyFor77 = makeFavKey({ mode: 'bus', id: 42, direction: '하교' })

let favoritesState = { routes: [], stations: [], venues: [], keys: [favKeyFor77] }
const toggleFavoriteKey = vi.fn()
const toggleFavoriteRoute = vi.fn()
const toggleFavoriteStation = vi.fn()

vi.mock('../../stores/useAppStore', () => ({
  default: (selector) =>
    selector({
      favorites: favoritesState,
      toggleFavoriteKey,
      toggleFavoriteRoute,
      toggleFavoriteStation,
    }),
}))

describe('FavoritesPage — favorites.keys(신규 favKey 스키마) 마이그레이션', () => {
  it('favorites.keys에만 저장된 버스 즐겨찾기가 해당 등/하교 탭에 보인다', () => {
    render(<FavoritesPage />)

    // 신규 favKey(makeFavKey({mode:'bus', id:42, direction:'하교'}))는 하교 탭에서 보여야 한다.
    fireEvent.click(screen.getByText('하교'))

    expect(screen.getAllByText('77').length).toBeGreaterThan(0)
    expect(screen.getByText(/테스트행/)).toBeInTheDocument()
  })

  it('등교 탭에는 나타나지 않는다(commute 분류가 direction을 따라간다)', () => {
    render(<FavoritesPage />)

    // 기본 탭은 등교 — 하교로 저장된 항목은 보이면 안 된다.
    expect(screen.queryByText('77')).not.toBeInTheDocument()
  })

  it('즐겨찾기 해제 시 toggleFavoriteKey가 호출된다(toggleFavoriteRoute 아님)', () => {
    render(<FavoritesPage />)
    fireEvent.click(screen.getByText('하교'))

    fireEvent.click(screen.getByLabelText('편집 메뉴'))
    fireEvent.click(screen.getByText('즐겨찾기 해제'))

    expect(toggleFavoriteKey).toHaveBeenCalledWith(favKeyFor77)
    expect(toggleFavoriteRoute).not.toHaveBeenCalled()
  })
})
