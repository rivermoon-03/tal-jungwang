import { useState } from 'react'
import { CalendarDays, MapPin } from 'lucide-react'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { ALL_VENUES } from '../../data/cafeteriaVenues'
import { isOpenNow, isVacationPeriod } from '../../utils/venueOpen'
import { buildDayLabelMap, getTodayDayKey } from '../../utils/cafeteriaDays'
import PageHeader from '../kit/PageHeader'
import Segmented from '../kit/Segmented'
import { Banner, Card, SectionLabel, Pill } from '../kit/bits'
import { nowMinutes } from '../transit/format'
import { MEAL_KINDS, currentMealKind, mealKindOf, pickMeal, venueIdOf } from './mealSelect'

const DAY_COLS = [
  ['weekday', '평일'],
  ['saturday', '토요일'],
]

export default function MealVenuePage({ venueId }) {
  const venue = ALL_VENUES.find((v) => v.id === venueId)
  const { data } = useCafeteriaMenu()
  const section = data?.cafeterias?.find((s) => venueIdOf(s.name) === venueId)
  const [kind, setKind] = useState(() => currentMealKind(nowMinutes()))
  const [period, setPeriod] = useState(() => (isVacationPeriod(new Date()) ? 'vacation' : 'semester'))

  if (!venue) return <Banner kind="error" title="없는 식당이에요" />
  const open = isOpenNow(venue)
  const sched = venue.schedule?.[period]
  const kinds = [...new Set(DAY_COLS.flatMap(([d]) => (sched?.[d] ?? []).map((m) => mealKindOf(m.type) ?? m.type)))]
  const slot = (d, k) => (sched?.[d] ?? []).find((m) => (mealKindOf(m.type) ?? m.type) === k)
  const nowKind = currentMealKind(nowMinutes())

  const dayKeys = Object.keys(section?.meals?.[0]?.by_day ?? {})
  const labels = buildDayLabelMap(data?.week_start, data?.year, dayKeys)
  const todayKey = getTodayDayKey(data?.week_start, data?.year, dayKeys)
  const sub = [venue.closedNote, venue.note].filter(Boolean).join('   ')

  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader
        title={venue.name}
        trailing={<Pill kind={open.open ? 'open' : 'closed'}>{open.open ? '운영 중' : open.primaryLabel}</Pill>}
        sub={
          <span className="flex flex-wrap items-center gap-x-3">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} aria-hidden="true" />
              {venue.location}
            </span>
            {sub}
          </span>
        }
        fallback="/cafeteria"
      />
      <div className="px-4">
        <Segmented
          className="mt-4"
          label="기간"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'semester', label: '학기 중' },
            { value: 'vacation', label: '방학' },
          ]}
        />
        <Card className="mt-3 px-3 py-1">
          <table className="w-full text-f15 tabular-nums">
            <thead>
              <tr className="text-f13 text-mute">
                <th className="py-2 text-left font-bold">끼니</th>
                {DAY_COLS.map(([d, l]) => (
                  <th key={d} className="py-2 text-left font-bold">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kinds.map((k) => (
                <tr key={k} className={`border-t border-line-soft ${k === nowKind ? 'bg-accent-bg' : ''}`}>
                  <td className={`py-2.5 pl-1 font-extrabold ${k === nowKind ? 'text-accent-ink' : 'text-ink'}`}>{k}</td>
                  {DAY_COLS.map(([d]) => {
                    const m = slot(d, k)
                    return (
                      <td key={d} className={`py-2.5 ${m ? 'text-ink' : 'text-mute'}`}>
                        {m ? `${m.start} ~ ${m.end}` : '없음'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {section && (
          <>
            <SectionLabel Icon={CalendarDays}>이번 주 메뉴</SectionLabel>
            <Segmented label="끼니" options={MEAL_KINDS.map((k) => ({ value: k, label: k }))} value={kind} onChange={setKind} />
            <ul className="mt-2">
              {Object.keys(labels).map((dk) => {
                const meal = pickMeal(section, kind, dk)
                const isToday = dk === todayKey
                const text = !meal ? '운영 안 해요' : meal.closed ? '미운영' : meal.items.length ? meal.items.join(', ') : '아직 안 올라왔어요'
                return (
                  <li key={dk} className="flex gap-4 border-b border-line-soft py-3">
                    <b className={`w-16 flex-none whitespace-nowrap text-f15 ${isToday ? 'text-accent-ink' : 'text-ink'}`}>{labels[dk]}</b>
                    <span className={`text-f15 ${isToday ? 'font-bold text-ink' : meal?.items.length ? 'text-ink' : 'text-mute'}`}>{text}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
