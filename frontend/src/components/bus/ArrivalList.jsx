import { useMemo } from 'react'
import BusArrivalCard from './BusArrivalCard'

const CATEGORY_ORDER = ['등교', '하교', '기타']
const CATEGORY_LABEL = { '등교': '등교', '하교': '하교', '기타': '기타 노선' }

function groupByRouteNo(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    if (!map.has(a.route_no)) map.set(a.route_no, [])
    map.get(a.route_no).push(a)
  }
  return Array.from(map.values())
}

function hasLiveInfo(groupArrivals) {
  return groupArrivals.some(
    (a) => a.minutes != null || a.predict_sec != null || a.arrive_in_seconds != null,
  )
}

function earliestMinutes(groupArrivals) {
  let min = Infinity
  for (const a of groupArrivals) {
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

function groupByCategory(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    const key = a.category ?? '기타'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(a)
  }
  // 정해진 순서대로 정렬, 알 수 없는 카테고리는 뒤에 추가
  const result = []
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) result.push({ category: cat, arrivals: map.get(cat) })
  }
  for (const [cat, items] of map) {
    if (!CATEGORY_ORDER.includes(cat)) result.push({ category: cat, arrivals: items })
  }
  return result
}

export default function ArrivalList({ arrivals, stationId, onTimetableClick, stationLabel, direction }) {
  // 카테고리별 그룹핑 + 각 섹션 내 노선별 그룹핑·정렬을 한 번에 메모.
  // arrivals reference 가 안 바뀌면 재계산하지 않음.
  const sections = useMemo(() => {
    if (!arrivals || arrivals.length === 0) return []
    const categorized = groupByCategory(arrivals)
    return categorized.map(({ category, arrivals: sectionArrivals }) => {
      const routeGroups = groupByRouteNo(sectionArrivals)
      routeGroups.sort((a, b) => {
        const aHas = hasLiveInfo(a)
        const bHas = hasLiveInfo(b)
        if (aHas !== bHas) return aHas ? -1 : 1
        return earliestMinutes(a) - earliestMinutes(b)
      })
      return { category, routeGroups }
    })
  }, [arrivals])

  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface dark:bg-bg-dark">
        <p className="text-meta font-semibold text-mute dark:text-mute-dark">도착 정보가 없습니다.</p>
      </div>
    )
  }

  const multiSection = sections.length > 1

  // 등교(accent) / 하교(imminent) / 기타(mute) 좌측 액센트 바
  const categoryAccent = (cat) => {
    if (cat === '등교') return 'bg-accent dark:bg-accent-dark'
    if (cat === '하교') return 'bg-imminent dark:bg-imminent-dark'
    return 'bg-mute-2 dark:bg-mute-2-dark'
  }

  return (
    <div className="flex-1 overflow-y-auto pb-28 md:pb-4">
      {stationLabel && direction && (
        <div className="px-4 pt-3.5 pb-1 flex items-center gap-2">
          <h3 className="text-panel-ttl text-ink dark:text-ink-dark">{stationLabel}</h3>
          <span className="text-meta font-extrabold text-text dark:text-text-dark bg-line dark:bg-line-dark px-2.5 py-1 rounded-full tracking-tight">
            {direction}
          </span>
        </div>
      )}
      <div className="p-4 space-y-4">
        {sections.map(({ category, routeGroups }) => (
          <div key={category}>
            {multiSection && (
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span aria-hidden className={`w-1 h-3.5 rounded-full ${categoryAccent(category)}`} />
                <p className="text-meta font-extrabold text-ink dark:text-ink-dark uppercase tracking-wider">
                  {CATEGORY_LABEL[category] ?? category}
                </p>
                <span className="text-meta font-semibold text-mute dark:text-mute-dark">{routeGroups.length}개 노선</span>
              </div>
            )}
            <div className="space-y-3">
              {routeGroups.map((group) => (
                <BusArrivalCard
                  key={group[0].route_no}
                  arrivals={group}
                  stationId={stationId}
                  onTimetableClick={onTimetableClick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
