import { useState } from 'react'
import { CalendarClock, History } from 'lucide-react'
import { useBusArrivals, useBusTimetableByRoute, useBusHistoryPreview } from '../../hooks/useBus'
import { navigate } from '../../lib/nav'
import { BUS_STATIONS } from './busStationConfig'
import PageHeader from '../kit/PageHeader'
import LineBadge from '../kit/LineBadge'
import Segmented from '../kit/Segmented'
import HourRows from '../kit/HourRows'
import { Banner, Card, SectionLabel, Skeleton } from '../kit/bits'
import { buildBusRows, seatsLabel } from './busRows'
import { clockToMinutes, delayVerdict, historyDelta, minutesLabel, nowMinutes, stopsLabel, ARRIVING_LABEL } from './format'
import { IMMINENT_THRESHOLD_SEC } from '../../utils/eta'

export default function BusRoutePage({ route, stop, view }) {
  if (view === 'timetable') return <BusTimetable route={route} stop={stop} />
  if (view === 'history') return <BusHistoryPage route={route} stop={stop} />
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

function positionOf(a) {
  return stopsLabel(a.location_no) ?? (a.arrive_in_seconds <= IMMINENT_THRESHOLD_SEC ? ARRIVING_LABEL : null)
}

/**
 * 노선 상세. 실시간 노선은 시간표가 없으므로 시간표 버튼 대신 도착 기록을 바로 펼친다.
 * 시간표 기반 노선만 시간표로 가는 버튼을 둔다.
 */
function BusRouteDetail({ route, stop }) {
  const { mine, realtime, loading, stationName } = useRouteArrivals(route, stop)
  const conf = Object.values(BUS_STATIONS).find((s) => s.gbisStationId === stop)
  const [row] = buildBusRows(mine, conf?.perRouteDisplay, nowMinutes())
  const [cur, nxt] = realtime
  const isRealtimeRoute = mine.some((a) => a.arrival_type === 'realtime')

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
              {positionOf(cur) && <p className="mt-1 text-f18 font-extrabold">{positionOf(cur)}</p>}
              {seatsLabel(cur.remain_seat) && <p className="mt-0.5 text-f13 text-[#adb5b2]">{seatsLabel(cur.remain_seat)}</p>}
            </div>
            <Card className="p-4">
              <p className="text-f13 text-mute">다음 차</p>
              <p className="mt-1 text-f32 font-extrabold tabular-nums text-ink">{nxt ? minutesLabel(nxt.arrive_in_seconds) : '없음'}</p>
              {nxt && positionOf(nxt) && <p className="mt-1 text-f18 font-extrabold text-ink">{positionOf(nxt)}</p>}
            </Card>
          </div>
        ) : (
          <div className="mt-4">
            <Banner title={row?.offService ? '오늘 운행이 끝났어요' : '지금 오는 차가 없어요'}>{row?.offService ? row?.position : null}</Banner>
          </div>
        )}

        {isRealtimeRoute ? (
          <>
            <SectionLabel Icon={History}>도착 기록</SectionLabel>
            <HistoryList route={route} stop={stop} etaSec={cur?.arrive_in_seconds} />
          </>
        ) : (
          !loading && (
            <button
              type="button"
              onClick={() => navigate(`/transit/bus/${encodeURIComponent(route)}?stop=${stop}&view=timetable`)}
              className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-f16 font-extrabold text-ink"
            >
              <CalendarClock size={18} aria-hidden="true" />
              시간표 보기
            </button>
          )
        )}
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

/** 지난 같은 요일들의 이 시간대(앞뒤 1시간) 실제 도착 시각. 결론 한 줄을 맨 위에 둔다. */
function HistoryList({ route, stop, etaSec }) {
  const { data, loading, error } = useBusHistoryPreview(route, stop)
  const nowMin = nowMinutes()
  const verdict = delayVerdict(historyDelta(data?.columns, etaSec, nowMin))
  const near = (times) => (times ?? []).filter((t) => Math.abs((clockToMinutes(t) ?? 0) - nowMin) <= 60)

  if (loading && !data) return <Skeleton className="h-40 rounded-[20px]" />
  if (error) return <Banner kind="error" title="기록을 불러오지 못했어요" />
  return (
    <div>
      {verdict && (
        <div className="mb-2 rounded-[20px] bg-imminent-bg px-5 py-4">
          <p className="text-f22 font-extrabold text-amber-900 dark:text-amber-200">{verdict}</p>
          <p className="text-f14 text-amber-900 dark:text-amber-200">지난 같은 요일, 이 시간대와 비교</p>
        </div>
      )}
      <Card as="ul" className="divide-y divide-line-soft">
        {(data?.columns ?? []).map((col) => {
          const times = near(col.times)
          return (
            <li key={col.date} className="flex gap-4 px-4 py-3.5">
              <div className="w-16 flex-none">
                <p className="text-f15 font-extrabold text-ink">{col.label}</p>
                <p className="text-f13 text-mute">{col.day_label}</p>
              </div>
              {times.length ? (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-f17 font-extrabold tabular-nums text-ink">
                  {times.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              ) : (
                <p className="self-center text-f15 text-mute">이 시간대 기록이 없어요</p>
              )}
            </li>
          )
        })}
      </Card>
    </div>
  )
}

function BusHistoryPage({ route, stop }) {
  const { realtime, stationName } = useRouteArrivals(route, stop)
  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route={route} />} title="도착 기록" sub={stationName} fallback="/transit" />
      <div className="px-4 pt-4">
        <HistoryList route={route} stop={stop} etaSec={realtime[0]?.arrive_in_seconds} />
      </div>
    </div>
  )
}
