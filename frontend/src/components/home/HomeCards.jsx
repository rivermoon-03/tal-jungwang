import useAppStore from '../../stores/useAppStore'
import { useBusArrivals } from '../../hooks/useBus'
import { useSubwayNext } from '../../hooks/useSubway'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { getTodayDayKey } from '../../utils/cafeteriaDays'
import { BUS_STATIONS, getBusStationDisplay } from '../transit/busStationConfig'
import { linkProps } from '../../lib/nav'
import LineBadge from '../kit/LineBadge'
import { buildBusRows } from '../transit/busRows'
import { minutesLabel, nowMinutes } from '../transit/format'
import { SUBWAY_LINES } from '../transit/subwayConfig'
import { currentMealKind, mealStatus, pickMeal, venueIdOf } from '../meal/mealSelect'

const CARD = 'block rounded-[22px] border border-[#272a29] bg-[rgba(23,25,24,.92)] text-[#eceeed] active:opacity-80'
const SUB = 'text-f13 text-[#adb5b2]'

function goTransit(mode) {
  return {
    ...linkProps('/transit'),
    onClick: (e) => {
      useAppStore.getState().setSelectedMode(mode)
      linkProps('/transit').onClick(e)
    },
  }
}

export function BusCard() {
  const station = useAppStore((s) => s.selectedBusStation)
  const conf = BUS_STATIONS[station]?.gbisStationId ? BUS_STATIONS[station] : BUS_STATIONS['한국공학대']
  const { data } = useBusArrivals(conf.gbisStationId)
  const [row] = buildBusRows(data?.arrivals, conf.perRouteDisplay, nowMinutes())
  const name = getBusStationDisplay(BUS_STATIONS[station]?.gbisStationId ? station : '한국공학대')
  return (
    <a {...goTransit('bus')} className={`${CARD} flex items-center gap-3.5 px-[18px] py-4`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {row && <LineBadge route={row.route} />}
          <span className="truncate text-f17 font-extrabold">{row?.dest ?? '버스'}</span>
          {row?.soon && <span className="flex-none rounded-[5px] bg-imminent px-1.5 py-0.5 text-f12 font-extrabold text-[#1a211e]">서두르기</span>}
        </div>
        <p className={`mt-1.5 truncate ${SUB}`}>{[name, row?.nextLabel].filter(Boolean).join(', ')}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="whitespace-nowrap text-f40 font-bold leading-none tracking-tight tabular-nums">{row?.main ?? '--'}</span>
        {row?.position && <span className="whitespace-nowrap text-f15 font-extrabold">{row.position}</span>}
      </div>
    </a>
  )
}

export function SubwayCard({ direction }) {
  const { data } = useSubwayNext({ tickMs: 30_000 })
  const keys = direction === '하교' ? ['line4_up', 'up'] : ['line4_down', 'down']
  const dirs = SUBWAY_LINES['정왕'].flatMap((l) => l.dirs.map((d) => ({ ...d, line: l.line })))
  const pick = keys
    .map((k) => ({ dir: dirs.find((d) => d.key === k), train: data?.[k] }))
    .filter((x) => x.train)
    .sort((a, b) => a.train.arrive_in_seconds - b.train.arrive_in_seconds)[0]
  return (
    <a {...goTransit('subway')} className={`${CARD} flex flex-col gap-1.5 px-4 py-3.5`}>
      {pick ? (
        <>
          <div className="flex items-center gap-1.5">
            <LineBadge route={pick.dir.line.replace('선', '')} size="sm" />
            <span className="truncate text-f14 font-bold">{pick.train.destination}행</span>
          </div>
          <span className="text-f28 font-bold tabular-nums">{minutesLabel(pick.train.arrive_in_seconds)}</span>
          <span className="text-f14 font-extrabold">{pick.train.depart_at} 출발</span>
          <span className={SUB}>정왕역 {pick.dir.label}</span>
        </>
      ) : (
        <span className="text-f15 font-bold text-[#adb5b2]">지금 오는 열차가 없어요</span>
      )}
    </a>
  )
}

export function MealCard() {
  const { data } = useCafeteriaMenu()
  const nowMin = nowMinutes()
  const kind = currentMealKind(nowMin)
  const section = data?.cafeterias?.find((s) => venueIdOf(s.name) === 'student-cafeteria')
  const dayKeys = Object.keys(section?.meals?.[0]?.by_day ?? {})
  const today = getTodayDayKey(data?.week_start, data?.year, dayKeys)
  const meal = today ? pickMeal(section, kind, today) : null
  const status = meal?.time ? mealStatus(meal.time, nowMin, true) : null
  const main = meal?.items?.[0]
  return (
    <a {...linkProps('/cafeteria')} className="flex flex-col gap-1 rounded-[20px] bg-[#0d2d2a] px-4 py-3.5 text-[#eceeed] active:opacity-80">
      <span className="text-f13 font-extrabold text-[#12a594]">{kind}  학생식당</span>
      <span className="text-f16 font-extrabold leading-snug">{main ?? (meal ? '아직 안 올라왔어요' : '오늘은 운영 안 해요')}</span>
      {status && <span className={SUB}>{status.text}</span>}
    </a>
  )
}

export function ShuttleCard({ direction }) {
  const dir = direction === '등교' ? 0 : 1
  const { data } = useShuttleNext(dir, { tickMs: 30_000 })
  const dest = dir === 0 ? '정왕역 출발 학교행' : '학교 출발 정왕역행'
  const sub = !data ? '내일 다시 운행해요' : data.is_last ? '오늘 막차' : data.next_depart_at ? `그다음 ${data.next_depart_at.slice(0, 5)}` : ''
  return (
    <a {...goTransit('shuttle')} className={`${CARD} flex items-center gap-3 px-4 py-3`}>
      <LineBadge route="셔틀" size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-f15 font-extrabold">{data ? dest : '오늘 셔틀 운행이 끝났어요'}</p>
        <p className={`truncate ${SUB}`}>{sub}</p>
      </div>
      {data && <span className="whitespace-nowrap text-f24 font-bold tabular-nums">{data.depart_at.slice(0, 5)}</span>}
    </a>
  )
}
