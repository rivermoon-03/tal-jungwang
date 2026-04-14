/**
 * FavoritesHero — coral→pink gradient card showing the closest upcoming favorite.
 * Props:
 *   item        { type, routeCode, stationName, minutes, walkMin, status }
 *   onGoSchedule — CTA callback when empty
 */
import { Bus, TramFront, TrainFront, MapPin } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import Skeleton from '../common/Skeleton'

const STATUS_DOT = {
  여유: { bg: 'bg-green-400', label: '🟢 여유' },
  빠듯: { bg: 'bg-yellow-400', label: '🟡 빠듯' },
  서두르세요: { bg: 'bg-red-500', label: '🔴 서두르세요' },
}

function RouteIcon({ type }) {
  if (type === 'shuttle') return <TramFront size={22} className="text-white/90" />
  if (type === 'subway') return <TrainFront size={22} className="text-white/90" />
  return <Bus size={22} className="text-white/90" />
}

export default function FavoritesHero({ item, loading, onGoSchedule }) {
  if (loading) {
    return (
      <div className="rounded-[18px] overflow-hidden shadow-card mx-0" style={{ background: 'linear-gradient(135deg, #FF385C 0%, #FF6B8A 100%)' }}>
        <div className="p-5 flex flex-col gap-3">
          <Skeleton height="1.25rem" width="60%" rounded="rounded-lg" className="bg-white/30" />
          <Skeleton height="2rem" width="80%" rounded="rounded-lg" className="bg-white/30" />
          <Skeleton height="1rem" width="40%" rounded="rounded-lg" className="bg-white/30" />
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="rounded-[18px] overflow-hidden shadow-card bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
        <EmptyState
          icon={<Bus size={36} />}
          title="아직 비어있어요"
          desc="자주 타는 노선이나 정류장을 즐겨찾기 해보세요"
          ctaLabel="시간표에서 추가"
          onCta={onGoSchedule}
        />
      </div>
    )
  }

  const statusInfo = STATUS_DOT[item.status] ?? STATUS_DOT['여유']

  return (
    <div
      className="rounded-[18px] overflow-hidden shadow-card p-5 flex flex-col gap-2"
      style={{ background: 'linear-gradient(135deg, #FF385C 0%, #FF6B8A 60%, #FF85A0 100%)' }}
    >
      {/* header row */}
      <div className="flex items-center gap-2">
        <RouteIcon type={item.type} />
        <span className="text-xs font-bold text-white/80 uppercase tracking-wider">
          {item.type === 'shuttle' ? '셔틀' : item.type === 'subway' ? '지하철' : '버스'}
        </span>
      </div>

      {/* route + station */}
      <div>
        <p className="text-2xl font-black text-white leading-tight">{item.routeCode}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin size={12} className="text-white/70" />
          <p className="text-sm text-white/80">{item.stationName}</p>
        </div>
      </div>

      {/* arrival + walk */}
      <div className="flex items-end justify-between mt-1">
        <div>
          <span className="text-4xl font-black text-white">{item.minutes ?? '~'}</span>
          <span className="text-base font-semibold text-white/80 ml-1">분 후 출발</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-white/70">도보 {item.walkMin ?? '?'}분</span>
          <span className="text-xs font-bold bg-white/20 text-white rounded-full px-2.5 py-0.5">
            {statusInfo.label}
          </span>
        </div>
      </div>
    </div>
  )
}
