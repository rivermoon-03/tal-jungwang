import { X } from 'lucide-react'
import IconButton from '../ui/IconButton'

// 결함 #1 — mapExpanded 상태의 "닫기" 버튼. 예전엔 이 버튼이 SDK 정상 렌더
// 경로에만 있어서, 카카오 SDK가 아직 안 떴거나(!sdkReady) 로드에 실패하면
// (sdkError) 전체화면 지도에서 빠져나갈 방법이 하나도 없었다. SDK 상태별
// early return 세 갈래와 정상 렌더 경로 모두가 이 버튼 하나를 공유한다.
// MapView 청크 지연 로드(2026-09) 이후로는 MapViewFallback도 이 버튼을 쓴다.
//
// 모양은 우측 상단 컨트롤 스택의 다른 버튼(학교로, 범례)과 같은 44px 원형이다.
// 예전엔 지도 아이콘 + "닫기" 텍스트의 70px 알약이라 스택 안에서 혼자 넓었고,
// 지도 아이콘은 "지도 열기"로 읽혔다(사용자 리포트).
export default function CloseMapButton({ onClose }) {
  return (
    <IconButton
      label="지도 닫기"
      title="지도 닫기"
      variant="floating"
      className="rounded-full border border-line dark:border-line active:scale-[0.94] transition-transform duration-press ease-spring"
      onClick={onClose}
    >
      <X size={18} strokeWidth={2.2} aria-hidden="true" className="text-ink dark:text-ink" />
    </IconButton>
  )
}
