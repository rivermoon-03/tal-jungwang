// 앱 어디서든 페이지 이동 없이 열 수 있는 ScheduleDetailModal.
// useAppStore.detailModal에 detail 객체를 세팅하면 현재 페이지 위에 그대로 뜬다.

import { useEffect, useState } from 'react'
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
  // 닫힘 애니메이션 동안 콘텐츠를 유지하려는 스냅샷이다. ref로 두면 렌더 중
  // 읽게 되어 동시성 렌더에서 값이 어긋날 수 있으므로 state로 보관한다.
  // 렌더 중 조정 패턴(React 공식 "Adjusting state when a prop changes").
  // effect로 미루면 렌더가 한 번 더 돌고, 그 사이 한 프레임 동안 빈 내용이 보인다.
  const [prevDetail, setPrevDetail] = useState(null)
  const [seenDetail, setSeenDetail] = useState(null)
  if (detail && detail !== seenDetail) {
    setSeenDetail(detail)
    setPrevDetail(detail)
  }
  const displayed = detail ?? prevDetail

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
