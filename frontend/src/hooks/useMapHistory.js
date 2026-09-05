/**
 * useMapHistory — 전체화면 지도(mapExpanded)를 브라우저 히스토리와 묶는다.
 *
 * 지도를 펼치면 같은 주소로 history 항목을 하나 쌓고(state.mapExpanded=true),
 * 뒤로가기(popstate)로 그 항목이 사라지면 지도를 접는다. 예전엔 지도를 편 채
 * 뒤로가기를 누르면 주소 해시만 바뀌고 지도는 그대로 열려 있었다(실측).
 *
 * 주소(경로, 해시)는 건드리지 않는다. 탭 해시(#map, #main)는 App.jsx 가
 * activeTab 으로 관리하는 별개 체계라, 지도 상태는 history.state 에만 적는다.
 *
 * @param {boolean} mapExpanded
 * @param {(v: boolean) => void} [setMapExpanded]
 */
import { useEffect } from 'react'

export function isMapHistoryEntry() {
  return Boolean(window.history.state?.mapExpanded)
}

export function useMapHistory(mapExpanded, setMapExpanded) {
  useEffect(() => {
    if (!mapExpanded || isMapHistoryEntry()) return
    window.history.pushState(
      { ...(window.history.state ?? {}), mapExpanded: true },
      '',
      window.location.href,
    )
  }, [mapExpanded])

  useEffect(() => {
    if (!setMapExpanded) return undefined
    const onPop = () => {
      if (!isMapHistoryEntry()) setMapExpanded(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setMapExpanded])
}
