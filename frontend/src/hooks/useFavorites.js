/**
 * useFavorites — 즐겨찾기 토글 훅
 *
 * 기존 useAppStore의 favorites.routes (string[]) 구조를 그대로 사용한다.
 * key는 FavoritesPage가 인식하는 식별자여야 한다:
 *  - 버스: 노선 번호 (예: '20-1', '시흥33')
 *  - 지하철: 'subway:{역이름}:{방향키}' (예: 'subway:정왕:up')
 *
 * 호환성: GlobalDetailModal·SchedulePage의 toggleFavoriteRoute와 동일한 저장소를
 * 공유하므로 어디서 토글해도 FavoritesPage에 즉시 반영된다.
 */
import useAppStore from '../stores/useAppStore'

export default function useFavorites(key) {
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const routes = favorites?.routes ?? []
  const isFavorite = Boolean(key) && routes.includes(key)
  return {
    isFavorite,
    toggle: () => {
      if (!key) return
      toggleFavoriteRoute(key)
    },
  }
}
