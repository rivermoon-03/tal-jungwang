// 앱 어디서든 페이지 이동 없이 열 수 있는 ScheduleDetailModal.
// useAppStore.detailModal에 detail 객체를 세팅하면 현재 페이지 위에 그대로 뜬다.

import { useEffect, useRef } from 'react'
import useAppStore from '../../stores/useAppStore'
import ScheduleDetailModal from './ScheduleDetailModal'

export default function GlobalDetailModal() {
  const detail             = useAppStore((s) => s.detailModal)
  const closeDetailModal   = useAppStore((s) => s.closeDetailModal)
  const favorites          = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const setMapPanTarget    = useAppStore((s) => s.setMapPanTarget)

  // vaul(모바일 바텀시트)의 닫힘 애니메이션 동안에도 콘텐츠가 유지되도록
  // detail이 null이 되기 직전 값을 스냅샷으로 들고 있는다(GlobalSubwayLineSheet와 동일 패턴).
  const prevDetail = useRef(null)
  useEffect(() => {
    if (detail) prevDetail.current = detail
  }, [detail])
  const displayed = detail ?? prevDetail.current

  const favCode = displayed?.favCode ?? null
  const isFav = favCode ? favorites.routes?.includes(favCode) ?? false : false

  const onShowMap =
    displayed?.mapLat != null && displayed?.mapLng != null
      ? () => {
          setMapPanTarget({ lat: displayed.mapLat, lng: displayed.mapLng })
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
      type={displayed?.type}
      routeCode={displayed?.routeCode}
      routeId={displayed?.routeId ?? null}
      stopId={displayed?.stopId ?? null}
      direction={displayed?.direction}
      subwayKey={displayed?.subwayKey}
      accentColor={displayed?.accentColor}
      isRealtime={displayed?.isRealtime ?? false}
      title={displayed?.title ?? ''}
      isFavorite={isFav}
      onToggleFav={favCode ? () => toggleFavoriteRoute(favCode) : null}
      onShowMap={onShowMap}
    />
  )
}
