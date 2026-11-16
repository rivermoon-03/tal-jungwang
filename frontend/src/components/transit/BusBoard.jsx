import { useState } from 'react'
import { ChevronDown, Star } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useBusArrivals } from '../../hooks/useBus'
import { BUS_STATIONS, getBusStationDisplay } from '../dashboard/busStationConfig'
import { navigate } from '../../lib/nav'
import LineBadge from '../kit/LineBadge'
import Freshness from '../kit/Freshness'
import { Banner, Skeleton } from '../kit/bits'
import StopSheet from './StopSheet'
import { buildBusRows } from './busRows'
import { nowMinutes } from './format'

export default function BusBoard() {
  const station = useAppStore((s) => s.selectedBusStation)
  const favorites = useAppStore((s) => s.favorites?.stations ?? [])
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)
  const [sheetOpen, setSheetOpen] = useState(false)

  const conf = BUS_STATIONS[station] ?? BUS_STATIONS['한국공학대']
  const gbis = conf.gbisStationId
  const { data, loading, error, fetchedAt } = useBusArrivals(gbis)
  const rows = buildBusRows(data?.arrivals, conf.perRouteDisplay, nowMinutes())
  const isFav = favorites.includes(station)
  const direction = conf.defaultDirection

  return (
    <section aria-label="버스 도착">
      <div className="flex items-center justify-between px-1 pt-3">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex h-11 items-baseline gap-2 rounded-lg text-left"
          aria-haspopup="dialog"
        >
          <span className="text-f22 font-extrabold text-ink">{getBusStationDisplay(station)}</span>
          <span className="text-f15 font-bold text-accent-ink">{direction}</span>
          <ChevronDown size={16} className="self-center text-mute" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          aria-pressed={isFav}
          onClick={() => toggleFavoriteStation(station)}
          className="flex h-11 w-11 items-center justify-center rounded-full"
        >
          <Star size={22} className={isFav ? 'fill-imminent text-imminent' : 'text-mute'} aria-hidden="true" />
        </button>
      </div>

      {!gbis ? (
        <ScheduleOnly conf={conf} />
      ) : (
        <div className="mt-2 rounded-3xl bg-[var(--tj-dock-bg)] px-3.5 pb-2 pt-3.5 text-[#eceeed]">
          <div className="flex justify-end border-b border-[#373b39] px-1 pb-2.5">
            <Freshness fetchedAt={fetchedAt} tone="dark" />
          </div>
          {loading && !data && <BoardSkeleton />}
          {error && !data && <p className="px-1 py-6 text-f15 text-[#adb5b2]">도착 정보를 불러오지 못했어요. 잠시 뒤 다시 시도할게요.</p>}
          {!loading && !error && rows.length === 0 && <p className="px-1 py-6 text-f15 text-[#adb5b2]">지금 오는 버스가 없어요</p>}
          <ul>
            {rows.map((r) => (
              <li key={r.route} className="border-b border-[#272a29] last:border-0">
                <button
                  type="button"
                  onClick={() => navigate(`/transit/bus/${encodeURIComponent(r.route)}?stop=${gbis}`)}
                  className="flex w-full items-center gap-3 px-1 py-3.5 text-left active:opacity-70"
                >
                  <LineBadge route={r.route} className="w-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-f18 font-extrabold">{r.dest || r.route}</p>
                    <p className="truncate text-f13 text-[#868e8b]">{[r.nextLabel, r.seats].filter(Boolean).join(', ') || ' '}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-f24 font-extrabold tabular-nums ${r.soon ? 'tj-blink text-imminent' : r.realtime && !r.offService ? '' : 'text-[#adb5b2]'}`}
                    >
                      {r.main}
                    </p>
                    {r.position && <p className="text-f15 font-extrabold">{r.position}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StopSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </section>
  )
}

function BoardSkeleton() {
  return (
    <div className="space-y-3 py-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 bg-[#272a29]" />
      ))}
    </div>
  )
}

/** 실시간이 없는 정류장(서울 출발)은 노선 목록과 시간표 이동만 준다. */
function ScheduleOnly({ conf }) {
  const routes = conf.routes?.[conf.defaultDirection] ?? Object.keys(conf.perRouteDisplay)
  return (
    <div className="mt-2 space-y-3">
      <Banner title="실시간 정보가 없는 정류장이에요">노선을 누르면 시간표를 볼 수 있어요.</Banner>
      <ul className="rounded-[20px] border border-line bg-surface">
        {routes.map((route) => {
          const d = conf.perRouteDisplay[route]
          return (
            <li key={route} className="border-b border-line-soft last:border-0">
              <button
                type="button"
                onClick={() => navigate(`/transit/bus/${encodeURIComponent(route)}?view=timetable`)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <LineBadge route={route} className="w-14" />
                <span className="flex-1 text-f16 font-bold text-ink">{d?.origin} 출발, {d?.dest}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
