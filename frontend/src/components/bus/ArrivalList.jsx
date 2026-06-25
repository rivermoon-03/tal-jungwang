import { useMemo } from 'react'
import BusArrivalCard from './BusArrivalCard'
import {
  getRouteCategory,
  ROUTE_CATEGORY_ORDER,
  ROUTE_CATEGORY_LABEL,
} from '../dashboard/busStationConfig'

const TOP_CATEGORY_ORDER = ['등교', '하교', '기타']
const TOP_CATEGORY_LABEL = { '등교': '등교', '하교': '하교', '기타': '기타 노선' }

function groupByRouteNo(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    if (!map.has(a.route_no)) map.set(a.route_no, [])
    map.get(a.route_no).push(a)
  }
  return Array.from(map.values())
}

function hasLiveInfo(g) {
  return g.some((a) => a.minutes != null || a.predict_sec != null || a.arrive_in_seconds != null)
}

function earliestMinutes(g) {
  let min = Infinity
  for (const a of g) {
    const m =
      a.minutes != null
        ? a.minutes
        : a.predict_sec != null
        ? Math.floor(a.predict_sec / 60)
        : a.arrive_in_seconds != null
        ? Math.floor(a.arrive_in_seconds / 60)
        : null
    if (m != null && m < min) min = m
  }
  return min === Infinity ? 9999 : min
}

function groupByTopCategory(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    const key = a.category ?? '기타'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  const result = []
  for (const c of TOP_CATEGORY_ORDER) {
    if (map.has(c)) result.push({ topCategory: c, arrivals: map.get(c) })
  }
  for (const [c, items] of map) {
    if (!TOP_CATEGORY_ORDER.includes(c)) result.push({ topCategory: c, arrivals: items })
  }
  return result
}

function groupByRouteCategory(routeGroups) {
  const buckets = new Map()
  for (const g of routeGroups) {
    const cat = getRouteCategory(g[0].route_no)
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat).push(g)
  }
  const sections = []
  for (const cat of ROUTE_CATEGORY_ORDER) {
    if (buckets.has(cat)) sections.push({ routeCategory: cat, groups: buckets.get(cat) })
  }
  for (const [cat, groups] of buckets) {
    if (!ROUTE_CATEGORY_ORDER.includes(cat)) sections.push({ routeCategory: cat, groups })
  }
  return sections
}

export default function ArrivalList({ arrivals, stationId, onTimetableClick, stationLabel, direction }) {
  const sections = useMemo(() => {
    if (!arrivals || arrivals.length === 0) return []
    const top = groupByTopCategory(arrivals)
    return top.map(({ topCategory, arrivals: secArrivals }) => {
      const routeGroups = groupByRouteNo(secArrivals)
      routeGroups.sort((a, b) => {
        const aHas = hasLiveInfo(a)
        const bHas = hasLiveInfo(b)
        if (aHas !== bHas) return aHas ? -1 : 1
        return earliestMinutes(a) - earliestMinutes(b)
      })
      const sub = groupByRouteCategory(routeGroups)
      return { topCategory, subSections: sub }
    })
  }, [arrivals])

  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface dark:bg-bg-dark">
        <p className="text-label font-semibold text-mute dark:text-mute-dark">도착 정보가 없습니다.</p>
      </div>
    )
  }

  const multiTop = sections.length > 1

  return (
    <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
      {stationLabel && direction && (
        <div className="px-4 pt-3.5 pb-1 flex items-center gap-2">
          <h3 className="text-panel-ttl text-ink dark:text-ink-dark">{stationLabel}</h3>
          <span className="text-label font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full tracking-tight">
            {direction}
          </span>
        </div>
      )}
      <div className="p-4 space-y-4">
        {sections.map(({ topCategory, subSections }) => (
          <div key={topCategory}>
            {multiTop && (
              <div className="mb-2.5 px-1 text-label font-extrabold text-text dark:text-text-dark">
                {TOP_CATEGORY_LABEL[topCategory] ?? topCategory}
              </div>
            )}
            <div className="space-y-3">
              {subSections.map(({ routeCategory, groups }) => (
                <div key={routeCategory}>
                  <div className="flex items-center gap-2.5 px-1 pt-1 pb-1.5">
                    <span className="text-label font-extrabold text-ink dark:text-ink-dark">
                      {ROUTE_CATEGORY_LABEL[routeCategory] ?? routeCategory}
                    </span>
                    <span className="ml-auto text-caption font-bold text-mute dark:text-mute-dark">
                      {groups.length} ROUTES
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groups.map((g) => (
                      <BusArrivalCard
                        key={g[0].route_no}
                        arrivals={g}
                        stationId={stationId}
                        onTimetableClick={onTimetableClick}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
