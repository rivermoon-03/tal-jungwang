/**
 * SchedulePage — 시간표 탭
 * - Mode pill: 지하철 · 버스 · 셔틀
 * - ⭐ 즐겨찾기만 toggle
 * - 검색 필터
 * - 섹션별 ScheduleSection cards
 */
import { useState } from 'react'
import { TrainFront, Bus, TramFront, Star } from 'lucide-react'
import ScheduleSearch from './ScheduleSearch'
import ScheduleSection from './ScheduleSection'
import useAppStore from '../../stores/useAppStore'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'

// ─── static section definitions ────────────────────────────────────────────
const BUS_SECTIONS = [
  { group: '정왕역', routes: ['20-1', '시흥33'] },
  { group: '서울',   routes: ['3400', '6502'] },
  { group: '기타',   routes: ['시흥1'] },
]

const SUBWAY_SECTIONS = [
  { group: '정왕',     stationCode: 'K449' },
  { group: '초지',     stationCode: 'K448' },
  { group: '시흥시청', stationCode: 'K447' },
]

const SHUTTLE_SECTIONS = [
  { group: '등교', direction: 0 },
  { group: '하교', direction: 1 },
]

// ─── mode pill config ────────────────────────────────────────────────────────
const MODES = [
  { id: 'subway',  label: '지하철', Icon: TrainFront },
  { id: 'bus',     label: '버스',   Icon: Bus },
  { id: 'shuttle', label: '셔틀',   Icon: TramFront },
]

// Routes that are realtime-only (no static timetable available)
const REALTIME_ONLY_ROUTES = new Set(['20-1', '시흥33'])

// ─── per-route bus section ───────────────────────────────────────────────────
function BusRouteSection({ routeCode, isFavorite, onToggleFav }) {
  const isRealtimeOnly = REALTIME_ONLY_ROUTES.has(routeCode)
  const { data, loading } = useBusTimetableByRoute(routeCode)
  // 백엔드는 { times: ["HH:MM", ...] } 형태로 반환
  const allTimes = data?.times ?? []
  const now = new Date()
  const future = allTimes
    .map((t) => {
      const [h, m] = (t ?? '00:00').split(':')
      const d = new Date()
      d.setHours(Number(h), Number(m), 0, 0)
      return d
    })
    .filter((d) => d > now)
    .sort((a, b) => a - b)

  const toStr = (d) =>
    d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null

  return (
    <ScheduleSection
      title={routeCode}
      subtitle="버스"
      type="bus"
      routeCode={routeCode}
      next={isRealtimeOnly ? null : (toStr(future[0]) ?? '—')}
      afterNext={isRealtimeOnly ? null : toStr(future[1])}
      realtimeOnly={isRealtimeOnly}
      isFavorite={isFavorite}
      onToggleFav={() => onToggleFav(routeCode)}
      loading={loading && !isRealtimeOnly}
    />
  )
}

// ─── subway section ──────────────────────────────────────────────────────────
function SubwaySection({ stationGroup, isFavorite, onToggleFav }) {
  const { data, loading } = useSubwayNext()
  // 백엔드 /subway/next 는 { up: {depart_at, arrive_in_seconds, destination}, down: {...}, ... } 반환
  // up/down 은 단일 객체 (배열 아님)
  const isJeongwang = stationGroup === '정왕'
  const upNext = isJeongwang ? data?.up : null

  return (
    <ScheduleSection
      title={stationGroup}
      subtitle="수인분당선"
      type="subway"
      routeCode={stationGroup}
      next={upNext?.depart_at ?? null}
      afterNext={null}
      isFavorite={isFavorite}
      onToggleFav={() => onToggleFav(`subway:${stationGroup}`)}
      loading={loading && isJeongwang}
      disabled={!isJeongwang}
      disabledLabel="일부 역 정보는 지원 예정"
    />
  )
}

// ─── shuttle section ─────────────────────────────────────────────────────────
function ShuttleSection({ direction, isFavorite, onToggleFav }) {
  const label = direction === 0 ? '등교' : '하교'
  // useShuttleSchedule: { data: { directions: [{direction, times:[{depart_at,note}]}] } }
  const { data, loading } = useShuttleSchedule(direction)

  // 해당 direction 의 times 배열에서 현재 시각 이후 항목 추출
  const now = new Date()
  const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const dirData = data?.directions?.find((d) => d.direction === direction)
  const futureTimes = (dirData?.times ?? [])
    .map((t) => (typeof t === 'string' ? t : t?.depart_at ?? ''))
    .filter((t) => t >= nowStr)

  return (
    <ScheduleSection
      title={`셔틀 ${label}`}
      subtitle="한국공학대학교"
      type="shuttle"
      routeCode={`셔틀${label}`}
      next={futureTimes[0] ? futureTimes[0].slice(0, 5) : null}
      afterNext={futureTimes[1] ? futureTimes[1].slice(0, 5) : null}
      isFavorite={isFavorite}
      onToggleFav={() => onToggleFav(`shuttle:${label}`)}
      loading={loading}
    />
  )
}

// ─── main component ──────────────────────────────────────────────────────────
export default function SchedulePage() {
  const [mode, setMode] = useState('bus')
  const [favOnly, setFavOnly] = useState(false)
  const [query, setQuery] = useState('')

  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)

  function isFav(code) {
    return favorites.routes?.includes(code) ?? false
  }

  function handleToggleFav(code) {
    toggleFavoriteRoute(code)
  }

  // Filter helper for query
  function matchesQuery(label) {
    if (!query) return true
    return label.toLowerCase().includes(query.toLowerCase())
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* controls */}
      <div className="px-4 pt-5 pb-2 flex flex-col gap-2 flex-shrink-0 bg-slate-50 dark:bg-slate-900">
        {/* mode + fav toggle row */}
        <div className="flex items-center gap-2">
          {/* mode pills */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all pressable ${
                  mode === id
                    ? 'bg-navy text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
          {/* fav toggle */}
          <button
            onClick={() => setFavOnly((v) => !v)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all pressable ml-auto ${
              favOnly
                ? 'bg-coral text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Star size={12} fill={favOnly ? 'currentColor' : 'none'} />
            즐겨찾기만
          </button>
        </div>
        {/* search */}
        <ScheduleSearch value={query} onChange={setQuery} />
      </div>

      {/* content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6 flex flex-col gap-4">
        {mode === 'bus' && BUS_SECTIONS.map(({ group, routes }) => {
          const visible = routes.filter(
            (r) => matchesQuery(r) && (!favOnly || isFav(r))
          )
          if (visible.length === 0) return null
          return (
            <div key={group}>
              <p className="text-xs font-bold text-slate-400 px-1 mb-2 uppercase tracking-wider">
                {group}
              </p>
              <div className="flex flex-col gap-2">
                {visible.map((routeCode) => (
                  <BusRouteSection
                    key={routeCode}
                    routeCode={routeCode}
                    isFavorite={isFav(routeCode)}
                    onToggleFav={handleToggleFav}
                  />
                ))}
              </div>
            </div>
          )
        })}

        {mode === 'subway' && SUBWAY_SECTIONS.filter(
          ({ group }) => matchesQuery(group) && (!favOnly || isFav(`subway:${group}`))
        ).map(({ group }) => (
          <SubwaySection
            key={group}
            stationGroup={group}
            isFavorite={isFav(`subway:${group}`)}
            onToggleFav={handleToggleFav}
          />
        ))}

        {mode === 'shuttle' && SHUTTLE_SECTIONS.filter(
          ({ group }) => matchesQuery(group) && (!favOnly || isFav(`shuttle:${group}`))
        ).map(({ group, direction }) => (
          <ShuttleSection
            key={group}
            direction={direction}
            isFavorite={isFav(`shuttle:${group}`)}
            onToggleFav={handleToggleFav}
          />
        ))}

        {/* empty state when fav filter yields nothing */}
        {favOnly && (
          <div className="py-4 text-center text-sm text-slate-400">
            {mode === 'bus' && BUS_SECTIONS.every(({ routes }) => !routes.some(isFav)) && '즐겨찾기된 버스가 없어요'}
            {mode === 'subway' && SUBWAY_SECTIONS.every(({ group }) => !isFav(`subway:${group}`)) && '즐겨찾기된 지하철 역이 없어요'}
            {mode === 'shuttle' && SHUTTLE_SECTIONS.every(({ group }) => !isFav(`shuttle:${group}`)) && '즐겨찾기된 셔틀이 없어요'}
          </div>
        )}
      </div>
    </div>
  )
}
