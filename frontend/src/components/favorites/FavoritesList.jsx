/**
 * FavoritesList — 즐겨찾기 타임라인 (Phase E/Q14).
 *
 * 상위 컴포넌트(FavoritesPage)가 매 15초 주기로 items를 전달한다.
 * 여기서는 minutes 오름차순(null은 맨 뒤) 정렬 후 공용 ArrivalRow로 렌더한다.
 *
 * Props:
 *   items      [{ id, type, routeCode, stationName, destination, minutes, detail }]
 *   onRemove   (id) => void
 *   onOpenDetail (detail) => void
 *
 * 각 행:
 *   - 좌측 도트 색상은 타입/노선 번호 매핑
 *   - 가운데: 노선 번호 + 방향(행선지·정류장 조합)
 *   - 우측: 남은 분 + 편집 버튼(… 메뉴 → 즐겨찾기 해제)
 *   - 3분 이하일 때 urgent
 */
import { useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import ArrivalRow from '../dashboard/ArrivalRow'

const ROUTE_COLOR = {
  // 버스 (시내=청록, 마을=주황, 광역=빨강, 20-1=파랑)
  '20-1':   '#2563EB',
  '5602':   '#2563EB',
  '시흥33': '#0891B2',
  '시흥1':  '#F97316',
  '3400':   '#DC2626',
  '6502':   '#DC2626',
  '3401':   '#DC2626',
  // 지하철 노선
  '수인분당선': '#F5A623',
  '4호선':     '#1B5FAD',
  '서해선':    '#75bf43',
}

const TYPE_FALLBACK_COLOR = {
  bus: '#2563EB',
  subway: '#64748B',
  shuttle: '#1b3a6e',
}

function resolveColor(item) {
  if (item.type === 'shuttle') return TYPE_FALLBACK_COLOR.shuttle
  return ROUTE_COLOR[item.routeCode] ?? TYPE_FALLBACK_COLOR[item.type] ?? '#64748B'
}

function resolveDirection(item) {
  // destination 또는 stationName 을 방향/서브 텍스트로 사용
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

  // minutes 오름차순, null은 맨 뒤로 (Q14)
  const sorted = [...items].sort((a, b) => {
    const am = a.minutes == null ? Number.POSITIVE_INFINITY : a.minutes
    const bm = b.minutes == null ? Number.POSITIVE_INFINITY : b.minutes
    return am - bm
  })

  if (sorted.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((item) => {
        const minutes = item.minutes ?? null
        const isUrgent = minutes != null && minutes <= 3
        const direction = resolveDirection(item)
        const color = resolveColor(item)
        const menuOpen = openMenu === item.id

        return (
          <div key={item.id} className="relative">
            <ArrivalRow
              routeColor={color}
              routeNumber={item.routeCode}
              direction={direction}
              minutes={minutes}
              isUrgent={isUrgent}
              onClick={onOpenDetail ? () => onOpenDetail(item.detail) : undefined}
              rightAddon={
                <button
                  type="button"
                  className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400"
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
