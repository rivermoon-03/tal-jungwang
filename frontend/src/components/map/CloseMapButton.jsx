import { Map as MapIcon } from 'lucide-react'

// 결함 #1 — mapExpanded 상태의 "닫기" 버튼. 예전엔 이 버튼이 SDK 정상 렌더
// 경로에만 있어서, 카카오 SDK가 아직 안 떴거나(!sdkReady) 로드에 실패하면
// (sdkError) 전체화면 지도에서 빠져나갈 방법이 하나도 없었다. SDK 상태별
// early return 세 갈래와 정상 렌더 경로 모두가 이 버튼 하나를 공유한다 —
// 마크업을 갈래마다 복붙하면 나중에 하나만 고치고 나머지는 놓치기 쉽다.
//
// MapView 청크 지연 로드(2026-09) 이후로는 MapView.jsx 안의 세 갈래뿐 아니라
// MapViewFallback(청크 다운로드 중 자리표시자)도 이 버튼을 쓴다 — 별도 파일로
// 뽑아야 MapView 본체를 아직 내려받지 않은 상태에서도 같은 버튼을 그릴 수 있다.
export default function CloseMapButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="지도 닫기"
      className="flex items-center gap-1.5 bg-surface/95 dark:bg-surface/95
                 border border-line dark:border-line rounded-card px-3 py-2
                 text-mini-ttl font-bold text-accent dark:text-accent shadow-pill
                 min-h-[40px] active:scale-[0.94] transition-transform duration-press ease-spring"
    >
      <MapIcon size={16} aria-hidden="true" />
      닫기
    </button>
  )
}
