import { useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { buildDayLabelMap, getTodayDayKey, isMenuWeekStale } from '../../utils/cafeteriaDays'
import { FOOD_COURT, RESTAURANTS } from '../../data/cafeteriaVenues'
import { isOpenNow } from '../../utils/venueOpen'
import { linkProps } from '../../lib/nav'
import Segmented from '../kit/Segmented'
import { Banner, Card, Skeleton, Pill } from '../kit/bits'
import { nowMinutes } from '../transit/format'
import { MEAL_KINDS, currentMealKind, mealStatus, pickMeal, venueIdOf } from './mealSelect'

const RAON = FOOD_COURT.find((v) => v.id === 'raon-restaurant')
const SOURCE_URL = 'https://ibook.tukorea.ac.kr/viewer/menu02'

function dayKeysOf(sections) {
  const set = new Set()
  for (const s of sections ?? []) for (const m of s.meals ?? []) for (const k of Object.keys(m.by_day ?? {})) set.add(k)
  return [...set]
}

export default function MealPage() {
  const { data, loading, error, refetch } = useCafeteriaMenu()
  const sections = data?.cafeterias ?? []
  const dayKeys = dayKeysOf(sections)
  const labels = buildDayLabelMap(data?.week_start, data?.year, dayKeys)
  const orderedKeys = Object.keys(labels).length ? dayKeys.filter((k) => labels[k]) : dayKeys
  const todayKey = getTodayDayKey(data?.week_start, data?.year, dayKeys)
  const [day, setDay] = useState(null)
  const [kind, setKind] = useState(() => currentMealKind(nowMinutes()))
  const activeDay = day ?? todayKey ?? orderedKeys[0]
  const stale = isMenuWeekStale(data?.week_start, data?.year, dayKeys)
  const isToday = activeDay === todayKey
  const nowMin = nowMinutes()

  const kindOptions = MEAL_KINDS.map((k) => ({
    value: k,
    label: k,
    disabled: Boolean(data) && !sections.some((s) => pickMeal(s, k, activeDay)),
  }))

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4">
      <h1 className="sr-only">학식</h1>
      {orderedKeys.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="날짜">
          {orderedKeys.map((k) => {
            const [num, wd] = (labels[k] ?? `${k}일()`).replace('일', '').replace(')', '').split('(')
            const on = k === activeDay
            return (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setDay(k)}
                className={`flex h-14 w-12 flex-none flex-col items-center justify-center rounded-2xl border ${
                  on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2'
                }`}
              >
                <span className="text-f12">{wd}</span>
                <b className="text-f17">{num}</b>
              </button>
            )
          })}
        </div>
      )}
      <Segmented className="mt-3" label="끼니" options={kindOptions} value={kind} onChange={setKind} />

      <div className="mt-4 space-y-2.5">
        {stale && <Banner kind="warn" title="지난주 식단이에요">이번 주 식단이 아직 안 올라왔어요.</Banner>}
        {loading && !data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[20px]" />)}
        {error && !data && (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <b className="text-f16 text-ink">식단</b>
              <Pill kind="error">불러오기 실패</Pill>
            </div>
            <button type="button" onClick={refetch} className="mt-3 flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-f14 font-extrabold text-ink">
              <RefreshCw size={15} aria-hidden="true" />
              다시 시도
            </button>
          </Card>
        )}
        {sections.map((s) => (
          <VenueCard key={s.name} section={s} kind={kind} day={activeDay} isToday={isToday} nowMin={nowMin} />
        ))}
        {data && RAON && <RaonCard />}
        {sections.some((s) => {
          const m = pickMeal(s, kind, activeDay)
          return m && !m.closed && m.items.length === 0
        }) && (
          <div className="px-1 pt-1">
            <SourceLink />
          </div>
        )}
      </div>
    </div>
  )
}

function VenueCard({ section, kind, day, isToday, nowMin }) {
  const meal = pickMeal(section, kind, day)
  const venue = RESTAURANTS.find((v) => v.id === venueIdOf(section.name))
  const status = meal?.time ? mealStatus(meal.time, nowMin, isToday) : null
  const href = venue ? `/cafeteria/${venue.id}` : null
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <b className="text-f16 text-ink">
          {venue?.name ?? section.name}
          {venue && <span className="ml-1.5 font-semibold text-mute">{venue.location}</span>}
        </b>
        {!meal ? (
          <Pill kind="closed">운영 안 해요</Pill>
        ) : meal.items.length === 0 && !meal.closed ? (
          <Pill kind="soon">미등록</Pill>
        ) : meal.closed ? (
          <Pill kind="closed">미운영</Pill>
        ) : (
          status && <Pill kind={status.kind}>{status.text}</Pill>
        )}
      </div>
      {meal?.items.length > 0 && (
        <>
          <p className="mt-1.5 text-f18 font-extrabold text-ink">{meal.items[0]}</p>
          {meal.items.length > 1 && <p className="mt-0.5 text-f15 leading-relaxed text-ink-2">{meal.items.slice(1).join(', ')}</p>}
        </>
      )}
      {meal && meal.items.length === 0 && !meal.closed && (
        <p className="mt-1.5 text-f15 text-ink-2">아직 안 올라왔어요</p>
      )}
    </>
  )
  return href ? (
    <Card as="a" {...linkProps(href)} className="p-4 active:bg-surface-2">
      {body}
    </Card>
  ) : (
    <Card className="p-4">{body}</Card>
  )
}

function RaonCard() {
  const open = isOpenNow(RAON)
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <b className="text-f16 text-ink">
          {RAON.name}
          <span className="ml-1.5 font-semibold text-mute">{RAON.location}</span>
        </b>
        <Pill kind={open.open ? 'open' : 'closed'}>{open.primaryLabel}</Pill>
      </div>
      <p className="mt-1.5 text-f15 font-bold text-ink">상시 메뉴  {RAON.menu?.join(', ')}</p>
    </Card>
  )
}

export function SourceLink() {
  return (
    <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-f14 font-extrabold text-accent-ink">
      <ExternalLink size={14} aria-hidden="true" />
      원문 페이지 열기
    </a>
  )
}
