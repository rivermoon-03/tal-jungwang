/**
 * FavoritesList — 즐겨찾기 리스트 뷰.
 *
 * 상위 컴포넌트(FavoritesPage)가 매 15초 주기로 items를 전달한다.
 * minutes 오름차순(null은 맨 뒤) 정렬 후 공용 TransitCard로 렌더한다.
 * 새 형식 버스 즐겨찾기(detail.routeId 존재)는 각 행에서 실시간/시간표를 직접 fetch한다.
 */
import { useMemo, useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import TransitCard from '../ui/TransitCard'
import IconButton from '../ui/IconButton'
import { useBusArrivals, useBusTimetable } from '../../hooks/useBus'
import useUndoRemove from './useUndoRemove'
import RemoveUndoToast from './RemoveUndoToast'
import { formatEta, formatHHMM, isImminent, IMMINENT_LABEL } from '../../utils/eta'
import { useNow } from '../../hooks/useNow'

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
      className="absolute right-0 top-8 z-30 bg-white dark:bg-surface rounded-tile shadow-sh-lift overflow-hidden min-w-[140px]"
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
    ? (isImminent(liveSeconds) ? IMMINENT_LABEL : null)
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

  // ETA 열: 상대시간이 주인공이고 그 아래 절대시각을 작게 병기한다. formatEta 는
  // 60분을 넘기면 스스로 절대시각으로 바꾸므로, 그때 또 붙이면 같은 정보가 두 번
  // 나온다 — "N분" 형태일 때만 병기한다. 렌더 중 Date.now() 를 부르지 않으려고
  // 1분 틱을 쓴다(react-hooks/purity).
  const nowMs = useNow(60_000)
  const firstSec =
    effectiveMinutes != null && Number.isFinite(effectiveMinutes) ? effectiveMinutes * 60 : null
  const etaResult = imminentLabel
    ? { text: imminentLabel, tone: 'imminent' }
    : firstSec == null
      ? { text: '운행 정보 없음', tone: 'muted' }
      : formatEta(firstSec)
  const absoluteTimeText =
    firstSec != null && etaResult.tone === 'normal' && /분$/.test(etaResult.text)
      ? formatHHMM(nowMs + firstSec * 1000)
      : null

  return (
    <div className="relative">
      <TransitCard
        badge={{ label: item.routeCode, mode: item.type }}
        title={direction ?? item.routeCode}
        chips={item.lastTrain ? [{ label: '막차', tone: 'warn' }] : []}
        statusDot={status}
        eta={{
          primary: {
            text: etaResult.text,
            tone: etaResult.tone === 'muted'
              ? 'muted'
              : etaResult.tone === 'imminent' ? 'imminent' : 'default',
          },
          secondary: absoluteTimeText ? { text: absoluteTimeText } : undefined,
        }}
        onClick={onOpenDetail ? () => onOpenDetail(item.detail) : undefined}
        rightAddon={
          <IconButton
            label="편집 메뉴"
            onClick={(e) => {
              e.stopPropagation()
              onToggleMenu()
            }}
          >
            <MoreVertical size={16} />
          </IconButton>
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
  // 삭제는 확인도 되돌리기도 없이 2탭이면 끝났다 — 해제 직후 되돌리기 토스트를 띄운다.
  const { pending, remove, undo } = useUndoRemove(onRemove)

  const sorted = [...items].sort((a, b) => {
    const am = a.minutes == null ? Number.POSITIVE_INFINITY : a.minutes
    const bm = b.minutes == null ? Number.POSITIVE_INFINITY : b.minutes
    return am - bm
  })

  function handleRemove(id) {
    const item = items.find((it) => it.id === id)
    remove(id, item?.routeCode)
  }

  // 목록이 비었어도 방금 지운 항목의 되돌리기 토스트는 남아 있어야 하므로,
  // pending이 없을 때만 null로 완전히 접는다.
  if (sorted.length === 0 && !pending) return null

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((item) => (
        <FavoriteRow
          key={item.id}
          item={item}
          menuOpen={openMenu === item.id}
          onToggleMenu={() => setOpenMenu(openMenu === item.id ? null : item.id)}
          onCloseMenu={() => setOpenMenu(null)}
          onRemove={handleRemove}
          onOpenDetail={onOpenDetail}
        />
      ))}
      <RemoveUndoToast pending={pending} onUndo={undo} />
    </div>
  )
}
