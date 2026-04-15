/**
 * FavoritesList — compact rows sorted by arrival time ascending.
 * Props:
 *   items     [{ id, type, routeCode, stationName, minutes, status }]
 *   onRemove  (id) => void
 */
import { useState } from 'react'
import { Bus, TramFront, TrainFront, MoreVertical, Trash2 } from 'lucide-react'

const ROUTE_COLOR = {
  // 버스 (다른 탭과 통일: 광역=빨강, 시내=청록, 20-1=파랑)
  '20-1': '#5096E6',
  '시흥33': '#33B5A5',
  '시흥1': '#33B5A5',
  '3400': '#E02020',
  '6502': '#E02020',
  // 지하철 노선
  '수인분당선': '#F5A623',
  '4호선': '#1B5FAD',
  '서해선': '#75bf43',
}

const SHUTTLE_COLOR = '#FF385C' // coral

const STATUS_STYLE = {
  여유: 'text-green-500',
  빠듯: 'text-yellow-500',
  서두르세요: 'text-red-500',
}

function RouteDot({ routeCode, type }) {
  // 지하철: 컬러 원 + 흰 아이콘
  if (type === 'subway') {
    const color = ROUTE_COLOR[routeCode] ?? '#64748B'
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
        style={{ background: color }}
      >
        <TrainFront size={15} className="text-white" />
      </span>
    )
  }
  // 셔틀: 코랄 원 + 흰 아이콘
  if (type === 'shuttle') {
    return (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0"
        style={{ background: SHUTTLE_COLOR }}
      >
        <TramFront size={15} className="text-white" />
      </span>
    )
  }
  // 버스: 컬러 원 + 번호
  const color = ROUTE_COLOR[routeCode]
  if (color) {
    const label = routeCode.replace(/^시흥/, '') // "시흥33" → "33"
    return (
      <span
        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white font-bold flex-shrink-0 ${
          label.length >= 4 ? 'text-[9px]' : label.length === 3 ? 'text-[10px]' : 'text-xs'
        }`}
        style={{ background: color }}
      >
        {label}
      </span>
    )
  }
  return <Bus size={20} className="text-navy dark:text-blue-300 flex-shrink-0" />
}

function RowMenu({ id, onRemove, onClose }) {
  return (
    <div
      className="absolute right-0 top-8 z-30 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden min-w-[120px]"
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

  const sorted = [...items].sort((a, b) => (a.minutes ?? 999) - (b.minutes ?? 999))

  if (sorted.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((item) => (
        <div
          key={item.id}
          role={onOpenDetail ? 'button' : undefined}
          tabIndex={onOpenDetail ? 0 : undefined}
          onClick={() => onOpenDetail?.(item.detail)}
          onKeyDown={(e) => {
            if (onOpenDetail && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              onOpenDetail(item.detail)
            }
          }}
          className={`relative flex items-center gap-3 bg-white dark:bg-slate-800 rounded-[14px] px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700 ${
            onOpenDetail ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
          }`}
        >
          <RouteDot routeCode={item.routeCode} type={item.type} />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
              {item.routeCode}
              {item.destination && (
                <span className="ml-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {item.destination}
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate">{item.stationName}</p>
          </div>

          <div className="flex flex-col items-end flex-shrink-0">
            <span className={`text-sm font-black ${STATUS_STYLE[item.status] ?? 'text-slate-700 dark:text-slate-300'}`}>
              {item.minutes != null ? `${item.minutes}분` : '~분'}
            </span>
          </div>

          <div className="relative">
            <button
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400"
              onClick={(e) => {
                e.stopPropagation()
                setOpenMenu(openMenu === item.id ? null : item.id)
              }}
              aria-label="편집 메뉴"
            >
              <MoreVertical size={16} />
            </button>
            {openMenu === item.id && (
              <>
                {/* backdrop */}
                <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                <RowMenu id={item.id} onRemove={onRemove} onClose={() => setOpenMenu(null)} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
