/**
 * FavoritesList — 즐겨찾기 리스트 뷰.
 *
 * 상위 컴포넌트(FavoritesPage)가 매 15초 주기로 items를 전달한다.
 * minutes 오름차순(null은 맨 뒤) 정렬 후 공용 ArrivalRow로 렌더한다.
 * 새 형식 버스 즐겨찾기(detail.routeId 존재)는 각 행에서 실시간/시간표를 직접 fetch한다.
 */
import { useMemo, useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import ArrivalRow from '../dashboard/ArrivalRow'
import { useBusArrivals, useBusTimetable } from '../../hooks/useBus'

function resolveDirection(item) {
  const parts = []
  if (item.destination) parts.push(item.destination)
  if (item.stationName) parts.push(item.stationName)
  return parts.length ? parts.join(' · ') : null
}

function computeBoardingStatus(arrivalMin, walkMin) {
  if (arrivalMin == null || walkMin == null) return null
  const diff = arrivalMin - walkMin
  if (diff >= 3) return 'ok'
  if (diff >= 0) return 'warn'
  return 'bad'
}

// 새 형식 버스 즐겨찾기(detail.routeId 있음)의 다음 출발까지 남은 분.
// 실시간 노선은 /bus/arrivals/{stopId}, 시간표 노선은 /bus/timetable/{routeId} 에서 계산.
// 남은 초까지 반환 — imminent(60초 미만) 판정에 초 단위 필요.
function useLiveBusArrival(detail, routeNumber) {
  const isRealtime = Boolean(detail?.isRealtime)
  const stopId = detail?.stopId != null ? String(detail.stopId) : null
  const routeId = detail?.routeId != null ? detail.routeId : null

  const arrivals = useBusArrivals(isRealtime && stopId ? stopId : null)
  const timetable = useBusTimetable(!isRealtime && routeId ? routeId : null)

  return useMemo(() => {
    if (isRealtime) {
      const list = arrivals.data?.arrivals
      if (!list?.length) return { seconds: null, minutes: null }
      const a = list.find((x) => x.route_no === routeNumber)
      if (!a || a.arrive_in_seconds == null) return { seconds: null, minutes: null }
      const seconds = Math.max(0, a.arrive_in_seconds)
      return { seconds, minutes: Math.max(0, Math.round(seconds / 60)) }
    }
    const times = timetable.data?.times
    if (!Array.isArray(times) || !times.length) return { seconds: null, minutes: null }
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const next = times.find((t) => t >= nowStr)
    if (!next) return { seconds: null, minutes: null }
    const [h, m] = next.split(':').map(Number)
    const d = new Date()
    d.setHours(h, m, 0, 0)
    const seconds = Math.max(0, Math.floor((d - new Date()) / 1000))
    return { seconds, minutes: Math.max(0, Math.round(seconds / 60)) }
  }, [isRealtime, arrivals.data, timetable.data, routeNumber])
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

function FavoriteRow({ item, menuOpen, onToggleMenu, onCloseMenu, onRemove, onOpenDetail }) {
  // 새 형식 버스 즐겨찾기(detail.routeId 존재)는 실시간/시간표를 여기서 직접 fetch.
  // 그 외(지하철·셔틀·레거시 버스 fav)는 상위에서 계산한 item.minutes 사용.
  const isNewFormatBus = item.type === 'bus' && item.detail?.routeId != null
  const liveArrival = useLiveBusArrival(
    isNewFormatBus ? item.detail : null,
    isNewFormatBus ? item.routeCode : null,
  )
  const effectiveMinutes = isNewFormatBus ? liveArrival.minutes : item.minutes
  const liveSeconds = isNewFormatBus ? liveArrival.seconds : null
  // 새 형식 버스는 여기서 직접 tick된 실시간 초를 보고, 그 외(지하철·셔틀·레거시)는
  // 상위(FavoritesPage)에서 계산해 넘긴 imminentLabel을 사용한다.
  const imminentLabel = isNewFormatBus
    ? (liveSeconds != null && liveSeconds < 60 ? '곧 도착' : null)
    : (item.imminentLabel ?? null)
  const direction = resolveDirection(item)
  const status = isNewFormatBus
    ? computeBoardingStatus(effectiveMinutes, item.walkMin ?? 5)
    : item.status === '여유'
      ? 'ok'
      : item.status === '빠듯'
        ? 'warn'
        : item.status === '서두르세요'
          ? 'bad'
          : null

  return (
    <div className="relative">
      <ArrivalRow
        route={item.routeCode}
        routeNumber={item.routeCode}
        direction={direction}
        minutes={effectiveMinutes}
        imminentLabel={imminentLabel}
        lastTrain={item.lastTrain}
        status={status}
        onClick={onOpenDetail ? () => onOpenDetail(item.detail) : undefined}
        rightAddon={
          <button
            type="button"
            className="p-1.5 ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
            aria-label="편집 메뉴"
          >
            <MoreVertical size={16} />
          </button>
        }
      />
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={onCloseMenu} />
          <RowMenu id={item.id} onRemove={onRemove} onClose={onCloseMenu} />
        </>
      )}
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
      {sorted.map((item) => (
        <FavoriteRow
          key={item.id}
          item={item}
          menuOpen={openMenu === item.id}
          onToggleMenu={() => setOpenMenu(openMenu === item.id ? null : item.id)}
          onCloseMenu={() => setOpenMenu(null)}
          onRemove={onRemove}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  )
}
