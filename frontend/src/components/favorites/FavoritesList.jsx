/**
 * FavoritesList — 즐겨찾기 리스트 뷰.
 *
 * 상위 컴포넌트(FavoritesPage)가 매 15초 주기로 items를 전달한다.
 * minutes 오름차순(null은 맨 뒤) 정렬 후 공용 ArrivalRow로 렌더한다.
 */
import { useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import ArrivalRow from '../dashboard/ArrivalRow'

function resolveDirection(item) {
  const parts = []
  if (item.destination) parts.push(item.destination)
  if (item.stationName) parts.push(item.stationName)
  return parts.length ? parts.join(' · ') : null
}

function RowMenu({ id, onRemove, onClose }) {
  return (
    <div
      className="absolute right-0 top-8 z-30 bg-white dark:bg-surface-dark rounded-xl shadow-lg border border-slate-100 dark:border-border-dark overflow-hidden min-w-[140px]"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        onClick={() => { onRemove(id); onClose() }}
      >
        <Trash2 size={15} />
        즐겨찾기 해제
      </button>
    </div>
  )
}

export default function FavoritesList({ items = [], onRemove, onOpenDetail }) {
  const [openMenu, setOpenMenu] = useState(null)

  const sorted = [...items].sort((a, b) => {
    const am = a.minutes == null ? Number.POSITIVE_INFINITY : a.minutes
    const bm = b.minutes == null ? Number.POSITIVE_INFINITY : b.minutes
    return am - bm
  })

  if (sorted.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((item) => {
        const direction = resolveDirection(item)
        const menuOpen = openMenu === item.id

        return (
          <div key={item.id} className="relative">
            <ArrivalRow
              route={item.routeCode}
              routeNumber={item.routeCode}
              direction={direction}
              minutes={item.minutes}
              lastTrain={item.lastTrain}
              status={item.status === '여유' ? 'ok' : item.status === '빠듯' ? 'warn' : item.status === '서두르세요' ? 'bad' : null}
              onClick={onOpenDetail ? () => onOpenDetail(item.detail) : undefined}
              rightAddon={
                <button
                  type="button"
                  className="p-1.5 ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    setOpenMenu(menuOpen ? null : item.id)
                  }}
                  aria-label="편집 메뉴"
                >
                  <MoreVertical size={16} />
                </button>
              }
            />
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                <RowMenu id={item.id} onRemove={onRemove} onClose={() => setOpenMenu(null)} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
