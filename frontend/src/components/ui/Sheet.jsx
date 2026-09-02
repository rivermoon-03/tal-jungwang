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
import { DOCK_RESERVED_PX } from '../common/FloatingDock'

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
  // hooks/useMediaQuery의 useIsDesktop 대신 ScheduleDetailModal.jsx의 isPC와 같은
  // 방식(window.matchMedia 직접 호출)을 쓴다 — Sheet는 이 앱의 아홉 시트가 전부
  // 거쳐가는 정본이라, useIsDesktop을 구독하면 그 훅을 부분적으로만 모킹해 둔
  // 기존 소비자 테스트들이 "useIsDesktop export가 없다"며 깨진다.
  const isDesktop =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

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
          // 결함 #8 — env(safe-area-inset-bottom)만 빼면 노치 여백만 비워질 뿐,
          // FloatingDock(bottom-[14px]에 떠 있는 독)이 차지하는 높이는 그대로
          // 남는다. 그래서 셔틀 상세 모달을 끝까지 내리면 마지막 시(hour) 그룹
          // 헤더가 독 뒤에 깔려 안 보였다. 독이 실제로 떠 있는 모바일(bottom
          // placement)에서만 DOCK_RESERVED_PX(FloatingDock.jsx 단일 출처)를 더
          // 얹는다 — PC는 FloatingDock 자체가 없어(PCSidebar 대체) 더하면 오히려
          // 빈 공간만 남는다.
          paddingBottom:
            placement !== 'bottom'
              ? undefined
              : isDesktop
                ? 'env(safe-area-inset-bottom)'
                : `calc(${DOCK_RESERVED_PX}px + env(safe-area-inset-bottom))`,
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
