// 앱 어디서든 페이지 이동 없이 열 수 있는 ScheduleDetailModal.
// useAppStore.detailModal에 detail 객체를 세팅하면 현재 페이지 위에 그대로 뜬다.

import useAppStore from '../../stores/useAppStore'
import ScheduleDetailModal from './ScheduleDetailModal'

export default function GlobalDetailModal() {
  const detail             = useAppStore((s) => s.detailModal)
  const closeDetailModal   = useAppStore((s) => s.closeDetailModal)
  const favorites          = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const setMapPanTarget    = useAppStore((s) => s.setMapPanTarget)

  const favCode = detail?.favCode ?? null
  const isFav = favCode ? favorites.routes?.includes(favCode) ?? false : false

  const onShowMap =
    detail?.mapLat != null && detail?.mapLng != null
      ? () => {
          setMapPanTarget({ lat: detail.mapLat, lng: detail.mapLng })
          closeDetailModal()
          if (window.location.pathname !== '/') {
            window.history.pushState({}, '', '/')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }
        }
      : null

  return (
    <ScheduleDetailModal
      open={detail != null}
      onClose={closeDetailModal}
      type={detail?.type}
      routeCode={detail?.routeCode}
      routeId={detail?.routeId ?? null}
      stopId={detail?.stopId ?? null}
      direction={detail?.direction}
      subwayKey={detail?.subwayKey}
      accentColor={detail?.accentColor}
      isRealtime={detail?.isRealtime ?? false}
      title={detail?.title ?? ''}
      isFavorite={isFav}
      onToggleFav={favCode ? () => toggleFavoriteRoute(favCode) : null}
      onShowMap={onShowMap}
    />
  )
}
