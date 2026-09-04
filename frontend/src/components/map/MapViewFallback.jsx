import CloseMapButton from './CloseMapButton'

// MapView 청크가 아직 도착하기 전(Suspense pending) 자리표시자.
//
// MapView.jsx의 sdkPlaceholder(SDK 로딩 중)와 같은 문구·레이아웃을 쓴다 —
// 지도가 차지하던 영역이 청크 로딩 중에 갑자기 비어 보이지 않게 같은 크기를
// 채운다. mapExpanded 상태에서는 CloseMapButton도 함께 그린다 — 카카오 SDK가
// 실패해도 닫기 버튼은 항상 뜬다는 기존 보장(결함 #1)을, MapView 본체조차
// 아직 없는 이 단계까지 확장한 것이다.
export default function MapViewFallback({ mapExpanded = false, onClose }) {
  return (
    <div className="flex-1 relative w-full h-full min-h-0 bg-surface-2 dark:bg-surface overflow-hidden select-none">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p className="text-mute text-base font-medium">지도를 불러오는 중...</p>
      </div>
      {mapExpanded && onClose && (
        <div
          className="absolute right-4 z-[55]"
          style={{ top: 'calc(env(safe-area-inset-top) + 64px)' }}
        >
          <CloseMapButton onClose={onClose} />
        </div>
      )}
    </div>
  )
}
