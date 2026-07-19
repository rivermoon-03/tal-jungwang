import { useEffect, useRef } from 'react'
import { X, Bookmark } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'

// DockQuickAccess — dock 위 팝오버. 즐겨찾기 최대 4건.
// FloatingDock 롱프레스 시 표시. onClose로 닫기.
// 각 항목 탭 → setDetailModal + 팝오버 닫기
// 즐겨찾기 0건 → 안내 메시지.
// ESC / 바깥 탭으로 닫힘.

function parseShuttleFav(favCode) {
  if (!favCode.startsWith('shuttle:')) return null
  const rest = favCode.slice(8)
  const isCampus2 = rest.startsWith('2캠 ')
  const campusTag = isCampus2 ? '2캠 ' : ''
  const label = rest.slice(campusTag.length)
  return {
    type: 'shuttle',
    routeCode: `${campusTag}셔틀${label}`,
    title: `${campusTag}셔틀버스 ${label}`,
    favCode,
  }
}

function parseBusFav(favCode) {
  const match = favCode.match(/^(등교|하교|기타):(.+)$/)
  if (!match) return null
  const [, category, routeNumber] = match
  return {
    type: 'bus',
    routeCode: routeNumber,
    title: `${routeNumber} (${category})`,
    favCode,
    category,
  }
}

function parseSubwayFav(favCode) {
  if (!favCode.startsWith('subway:')) return null
  const parts = favCode.split(':')
  const station = parts[1] ?? '정왕'
  const dir = parts[2] ?? 'up'
  const dirLabel = dir === 'up' ? '왕십리행' : dir === 'down' ? '인천행' : '행선지'
  return {
    type: 'subway',
    routeCode: `${station} (${dirLabel})`,
    title: `${station} ${dirLabel}`,
    favCode,
    station,
    dir,
  }
}

function parseFavCode(favCode) {
  if (favCode.startsWith('shuttle:')) return parseShuttleFav(favCode)
  if (favCode.startsWith('subway:')) return parseSubwayFav(favCode)
  return parseBusFav(favCode)
}

export default function DockQuickAccess({ onClose }) {
  const favorites = useAppStore((s) => s.favorites)
  const setDetailModal = useAppStore((s) => s.setDetailModal)
  const containerRef = useRef(null)

  const routes = favorites?.routes ?? []
  const displayItems = routes.slice(0, 4).map(parseFavCode).filter(Boolean)

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
      className="absolute bottom-full right-0 mb-3 rounded-card border border-line-strong bg-surface dark:bg-surface shadow-lg"
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
              className="w-full px-4 py-3 text-sm text-left text-ink dark:text-ink hover:bg-surface-hover dark:hover:bg-surface-hover transition-colors active:bg-surface-active dark:active:bg-surface-active"
              type="button"
            >
              <div className="font-medium truncate">{item.routeCode}</div>
              <div className="text-caption text-mute dark:text-mute truncate">{item.title}</div>
            </button>
          ))}
        </div>
      )}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
