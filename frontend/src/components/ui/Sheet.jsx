/**
 * Sheet — 바텀시트와 모달의 정본.
 *
 * 앱에 독립 구현이 아홉 벌 있었다. Escape 처리는 어떤 것에는 있고 어떤 것에는
 * 없었고(StatsSheet 와 ShuttleNotifySheet 만 손으로 복사한 같은 코드를 들고
 * 있었다), 백드롭도 bg-black/50 blur 와 bg-black/30 으로 갈렸으며, z-index 는
 * 임의값이었다. 이 컴포넌트가 그 넷을 한 곳에서 책임진다.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} props.label              접근성 라벨
 * @param {'bottom'|'center'} [props.placement]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]        패널에 얹을 추가 클래스
 * @param {boolean} [props.showGrip]        모바일 드래그 손잡이. PC 에서는 꺼둔다.
 */
import { useEffect, useRef } from 'react'

// bottom 배치 시트가 화면 바닥(safe-area 위)에서 띄우는 최소 여백.
const SHEET_BOTTOM_GAP_PX = 12

export default function Sheet({
  open,
  onClose,
  label,
  placement = 'bottom',
  children,
  className = '',
  showGrip = placement === 'bottom',
}) {
  const panelRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab') return

      // 포커스 트랩. 시트가 열려 있는 동안 뒤 화면으로 탭이 새지 않게 한다.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const panelPos =
    placement === 'bottom'
      ? 'inset-x-0 bottom-0 rounded-t-sheet max-h-[88dvh]'
      : 'left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-sheet max-h-[86dvh]'

  return (
    <>
      <div
        className="fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={[
          'fixed z-sheet flex flex-col overflow-hidden',
          'bg-surface dark:bg-surface shadow-sh-lift',
          panelPos,
          className,
        ].join(' ')}
        style={{
          // 예전엔 bottom 배치에서 DOCK_RESERVED_PX(76px)를 더 비웠다. 셔틀 상세
          // 모달이 독 뒤에 가려지던 시절의 처방인데, 지금은 시트(z-sheet 100)와
          // 백드롭(z-overlay 90)이 독(z-nav 50) 위에 있어 독은 어차피 눌리지도
          // 보이지도 않는다. 그 76px이 액션 버튼 아래 흰 띠로만 남았다(실측
          // 100px). safe-area와 최소 손가락 여백만 비운다.
          paddingBottom:
            placement !== 'bottom'
              ? undefined
              : `calc(${SHEET_BOTTOM_GAP_PX}px + env(safe-area-inset-bottom))`,
        }}
      >
        {showGrip && (
          <div className="flex flex-none justify-center pt-2.5 pb-1" aria-hidden="true">
            <span className="h-1 w-9 rounded-pill bg-line-strong" />
          </div>
        )}
        {children}
      </div>
    </>
  )
}
