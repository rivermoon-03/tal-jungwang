import { useEffect, useRef } from 'react'
import { X, Bookmark, ChevronRight } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { parseFavCode } from '../../utils/favCode'

// DockQuickAccess — dock 위 팝오버. 즐겨찾기 최대 4건.
// FloatingDock 롱프레스 시 표시. onClose로 닫기.
// 각 항목 탭 → setDetailModal + 팝오버 닫기
// 즐겨찾기 0건 → 안내 메시지.
// ESC / 바깥 탭으로 닫힘.

export default function DockQuickAccess({ onClose }) {
  const favorites = useAppStore((s) => s.favorites)
  const setDetailModal = useAppStore((s) => s.setDetailModal)
  const containerRef = useRef(null)

  const routes = favorites?.routes ?? []
  const displayItems = routes.slice(0, 4).map(parseFavCode).filter(Boolean)
  // 팝오버는 4건까지만 보여준다. 나머지를 볼 방법이 없으면 즐겨찾기가 사실상
  // 4칸짜리 기능이 되므로, 전체 목록(/favorites)으로 나가는 길을 항상 열어 둔다.
  const hiddenCount = Math.max(0, routes.length - displayItems.length)

  const goAll = () => {
    window.history.pushState({}, '', '/favorites')
    window.dispatchEvent(new PopStateEvent('popstate'))
    onClose()
  }

  const handleItemClick = (item) => {
    if (!item) return
    const { type, routeCode, title, favCode, ...rest } = item
    setDetailModal({
      type,
      routeCode,
      title,
      favCode,
      ...rest,
    })
    onClose()
  }

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    document.addEventListener('pointerdown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('pointerdown', handleClickOutside)
    }
  }, [onClose])

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full right-0 mb-3 rounded-card border border-line-strong bg-surface dark:bg-surface shadow-sh-lift"
      style={{
        animation: prefersReducedMotion ? undefined : 'fadeIn 200ms ease-out',
      }}
    >
      {displayItems.length === 0 ? (
        <div className="px-4 py-3 w-full max-w-xs text-caption text-mute dark:text-mute flex items-start gap-2">
          <Bookmark size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>즐겨찾기를 추가하면 여기서 바로 열 수 있어요</span>
        </div>
      ) : (
        <div className="divide-y divide-line-soft dark:divide-line-soft">
          {displayItems.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleItemClick(item)}
              // bg-surface-hover/bg-surface-active는 tailwind.config.js에 정의되지
              // 않은 토큰이라 클래스 자체가 CSS를 만들지 않았다(hover/press 피드백
              // 없이 조용히 죽어 있던 자리) — 실재하는 surface-2/surface-3로 교체.
              className="w-full px-4 py-3 text-sm text-left text-ink dark:text-ink hover:bg-surface-2 dark:hover:bg-surface-2 transition-colors active:bg-surface-3 dark:active:bg-surface-3"
              type="button"
            >
              <div className="font-medium truncate">{item.routeCode}</div>
              <div className="text-caption text-mute dark:text-mute truncate">{item.title}</div>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={goAll}
        className="flex w-full min-h-[44px] items-center justify-between gap-2 border-t border-line-soft dark:border-line-soft px-4 text-caption font-semibold text-accent-ink dark:text-accent-ink hover:bg-surface-2 dark:hover:bg-surface-2"
      >
        <span>{hiddenCount > 0 ? `즐겨찾기 전체 보기 (+${hiddenCount})` : '즐겨찾기 전체 보기'}</span>
        <ChevronRight size={16} className="flex-none" aria-hidden="true" />
      </button>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
