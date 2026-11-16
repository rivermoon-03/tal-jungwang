import { useState } from 'react'
import { CalendarClock, History } from 'lucide-react'
import { useBusArrivals, useBusTimetableByRoute, useBusHistoryPreview } from '../../hooks/useBus'
import { navigate } from '../../lib/nav'
import { BUS_STATIONS } from '../dashboard/busStationConfig'
import PageHeader from '../kit/PageHeader'
import LineBadge from '../kit/LineBadge'
import Segmented from '../kit/Segmented'
import HourRows from '../kit/HourRows'
import { Banner, Card, Skeleton } from '../kit/bits'
import { buildBusRows } from './busRows'
import { clockToMinutes, delayVerdict, historyDelta, minutesLabel, nowMinutes, stopsLabel, ARRIVING_LABEL } from './format'

export default function BusRoutePage({ route, stop, view }) {
  if (view === 'timetable') return <BusTimetable route={route} stop={stop} />
  if (view === 'history') return <BusHistory route={route} stop={stop} />
  return <BusRouteDetail route={route} stop={stop} />
}

function useRouteArrivals(route, stop) {
  const { data, loading, fetchedAt } = useBusArrivals(stop ?? null)
  const mine = (data?.arrivals ?? []).filter((a) => a.route_no === route)
  const realtime = mine
    .filter((a) => a.arrival_type === 'realtime' && a.arrive_in_seconds != null)
    .sort((a, b) => a.arrive_in_seconds - b.arrive_in_seconds)
  return { mine, realtime, loading, fetchedAt, stationName: data?.station_name }
}

function BusRouteDetail({ route, stop }) {
  const { mine, realtime, loading, stationName } = useRouteArrivals(route, stop)
  const conf = Object.values(BUS_STATIONS).find((s) => s.gbisStationId === stop)
  const [row] = buildBusRows(mine, conf?.perRouteDisplay, nowMinutes())
  const [cur, nxt] = realtime
  const history = useBusHistoryPreview(route, stop)
  const verdict = delayVerdict(historyDelta(history.data?.columns, cur?.arrive_in_seconds, nowMinutes()))
  const qs = `stop=${stop}`

  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route={route} />} title={row?.dest && row.dest !== route ? row.dest : '노선 상세'} sub={stationName} fallback="/transit" />
      <div className="px-4">
        {loading && !mine.length ? (
          <Skeleton className="mt-4 h-32 rounded-[20px]" />
        ) : cur ? (
          <div className="mt-4 grid grid-cols-[1.3fr_1fr] gap-2.5">
            <div className="rounded-[20px] bg-[var(--tj-dock-bg)] p-4 text-[#eceeed]">
              <p className="text-f13 text-[#adb5b2]">이번 차</p>
              <p className={`mt-1 text-f32 font-extrabold ${cur.arrive_in_seconds <= 180 ? 'tj-blink text-imminent' : ''}`}>{minutesLabel(cur.arrive_in_seconds)}</p>
              <p className="mt-1 text-f18 font-extrabold">{stopsLabel(cur.location_no) ?? ARRIVING_LABEL}</p>
            </div>
            <Card className="p-4">
              <p className="text-f13 text-mute">다음 차</p>
              <p className="mt-1 text-f32 font-extrabold tabular-nums text-ink">{nxt ? minutesLabel(nxt.arrive_in_seconds) : '없음'}</p>
              {nxt && <p className="mt-1 text-f18 font-extrabold text-ink">{stopsLabel(nxt.location_no) ?? ARRIVING_LABEL}</p>}
            </Card>
          </div>
        ) : (
          <div className="mt-4">
            <Banner title={row?.offService ? '오늘 운행이 끝났어요' : '지금 오는 차가 없어요'}>{row?.position}</Banner>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => navigate(`/transit/bus/${encodeURIComponent(route)}?${qs}&view=timetable`)}
            className="flex min-h-16 flex-col justify-center rounded-2xl border border-line bg-surface px-4 text-left"
          >
            <span className="flex items-center gap-1.5 text-f16 font-extrabold text-ink">
              <CalendarClock size={17} aria-hidden="true" />
              시간표
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate(`/transit/bus/${encodeURIComponent(route)}?${qs}&view=history`)}
            className="flex min-h-16 flex-col justify-center rounded-2xl border border-line bg-surface px-4 text-left"
          >
            <span className="flex items-center gap-1.5 text-f16 font-extrabold text-ink">
              <History size={17} aria-hidden="true" />
              도착 기록
            </span>
            {verdict && <span className="text-f13 font-bold text-amber-800 dark:text-amber-300">{verdict}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}

const DAY_TYPES = [
  { value: 'weekday', label: '평일' },
  { value: 'saturday', label: '토요일' },
  { value: 'sunday', label: '일, 공휴일' },
]

function todayType() {
  const d = new Date().getDay()
  return d === 0 ? 'sunday' : d === 6 ? 'saturday' : 'weekday'
}

function BusTimetable({ route, stop }) {
  const [type, setType] = useState(todayType)
  const { data, loading, error } = useBusTimetableByRoute(route, { stopId: stop ?? undefined, scheduleType: type })
  const times = data?.times ?? []
  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route={route} />} title="시간표" sub={data?.stop_name} fallback="/transit" />
      <div className="px-4">
        <Segmented className="mt-3" label="요일" options={DAY_TYPES} value={type} onChange={setType} />
        <div className="mt-2">
          {loading && !data ? (
            <Skeleton className="mt-3 h-64" />
          ) : error ? (
            <Banner kind="error" title="시간표를 불러오지 못했어요" />
          ) : (
            <HourRows times={times} nowMin={type === todayType() ? nowMinutes() : -1} lastRaw={times[times.length - 1]} />
          )}
        </div>
      </div>
    </div>
  )
}

function BusHistory({ route, stop }) {
  const { realtime, stationName } = useRouteArrivals(route, stop)
  const { data, loading, error } = useBusHistoryPreview(route, stop)
  const nowMin = nowMinutes()
  const delta = historyDelta(data?.columns, realtime[0]?.arrive_in_seconds, nowMin)
  const verdict = delayVerdict(delta)
  const near = (times) => (times ?? []).filter((t) => Math.abs((clockToMinutes(t) ?? 0) - nowMin) <= 60)

  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route={route} />} title="도착 기록" sub={stationName ?? data?.stop_name} fallback="/transit" />
      <div className="px-4">
        {verdict && (
          <div className="mt-4 rounded-[20px] bg-imminent-bg px-5 py-4">
            <p className="text-f26 font-extrabold text-amber-900 dark:text-amber-200">{verdict}</p>
            <p className="text-f14 text-amber-900 dark:text-amber-200">지난 같은 요일, 이 시간대와 비교</p>
          </div>
        )}
        {loading && !data && <Skeleton className="mt-4 h-48" />}
        {error && <div className="mt-4"><Banner kind="error" title="기록을 불러오지 못했어요" /></div>}
        {(data?.columns ?? []).map((col) => {
          const times = near(col.times)
          return (
            <div key={col.date} className="mt-5">
              <p className="px-1 pb-2 text-f15 font-extrabold text-ink">
                {col.label} <span className="font-bold text-mute">{col.day_label}</span>
              </p>
              {times.length ? (
                <div className="flex flex-wrap gap-2 px-1 text-f18 font-extrabold tabular-nums text-ink">
                  {times.map((t) => (
                    <span key={t} className="rounded-xl bg-surface-2 px-2.5 py-1">{t}</span>
                  ))}
                </div>
              ) : (
                <p className="px-1 text-f15 text-mute">이 시간대 기록이 없어요</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
