import { useState, useEffect, useMemo } from 'react'
import { Bus, MapPin, School } from 'lucide-react'
import { useShuttleSchedule } from '../../hooks/useShuttle'

// direction int → 내부 key
// 0=본캠 등교, 1=본캠 하교, 2=2캠 등교, 3=2캠 하교
const DIR_KEY = { 0: 'school', 1: 'station', 2: 'school2', 3: 'station2' }
// 내부 key → direction int
const KEY_DIR = { school: 0, station: 1, school2: 2, station2: 3 }

const CAMPUS_META = {
  main:   { label: '본캠' },
  second: { label: '2캠' },
}

// 왼쪽=등교, 오른쪽=하교
const CAMPUS_PAIRS = {
  main:   { left: { key: 'school',   label: '학교 (등교)',   Icon: School }, right: { key: 'station',  label: '정왕역 (하교)', Icon: MapPin } },
  second: { left: { key: 'school2',  label: '등교 (2캠)',    Icon: School }, right: { key: 'station2', label: '하교 (2캠)',    Icon: MapPin } },
}

const campusOf = (dir) => (dir >= 2 ? 'second' : 'main')

function toMin(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function findNextTwo(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const upcoming = times.filter((t) => toMin(t.depart_at) > nowMin)
  return [upcoming[0] ?? null, upcoming[1] ?? null]
}

/** 수시운행 구간 안에 있는지 여부 (note === '수시운행' 항목 기준). */
function isInsideFrequentWindow(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const hasPastFrequent = times.some((t) => t.note === '수시운행' && toMin(t.depart_at) <= nowMin)
  const next = times.find((t) => toMin(t.depart_at) > nowMin)
  return hasPastFrequent && next?.note === '수시운행'
}

/** 수시운행 회차 구간 안에 있는지 여부. */
function isInsideFrequentReturnWindow(times) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const lastPast = [...times].reverse().find((t) => toMin(t.depart_at) <= nowMin)
  return !!(lastPast?.note?.startsWith('회차편') && lastPast.note.includes('수시운행'))
}

function departLabel(next, { inFrequent, inFrequentReturn }) {
  if (!next) return null
  if (inFrequent)       return { main: '수시운행', sub: null }
  if (inFrequentReturn) return { main: '수시 회차 중', sub: '수시운행' }
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const diffMin = toMin(next.depart_at) - nowMin

  if (next.note?.startsWith('회차편')) {
    if (diffMin < 1) return { main: '곧 출발', sub: '회차편' }
    return { main: `${diffMin}분 뒤`, sub: '회차편' }
  }
  if (diffMin < 1) return { main: '곧 출발', sub: null }
  return { main: `${diffMin}분 뒤`, sub: null }
}

function TimeCell({ label, Icon, pair, times, onClick }) {
  const [next, afterNext] = pair
  const inFrequent       = isInsideFrequentWindow(times)
  const inFrequentReturn = isInsideFrequentReturnWindow(times)
  const countdown = departLabel(next, { inFrequent, inFrequentReturn })
  const hideTime = inFrequent || inFrequentReturn
  const firstTrip = times[0] ?? null
  return (
    <div
      className="p-4 md:p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 active:bg-slate-100 dark:active:bg-slate-800 transition-colors"
      onClick={onClick}
    >
      <p className="text-sm md:text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1"><Icon size={11} /> {label}</p>
      {next ? (
        <>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {!hideTime && (
              <span className="text-xl md:text-[17px] font-extrabold text-navy dark:text-blue-300 tabular-nums">
                {next.depart_at}
              </span>
            )}
            {countdown && (
              <span className={`font-semibold text-blue-500 dark:text-blue-400 ${hideTime ? 'text-xl md:text-[17px]' : 'text-sm md:text-xs'}`}>
                {countdown.main}
              </span>
            )}
          </div>
          {countdown?.sub && (
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mt-0.5">{countdown.sub}</p>
          )}
          {!hideTime && afterNext && (
            <p className="text-sm md:text-xs text-slate-400 mt-1">다다음 {afterNext.depart_at}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm md:text-xs text-slate-400 mt-1">운행 종료</p>
          {firstTrip && (
            <p className="text-xs text-slate-400 mt-0.5">첫차 {firstTrip.depart_at}</p>
          )}
        </>
      )}
    </div>
  )
}

export default function ShuttleCard({ onOpenSheet }) {
  const { data: schedule, loading } = useShuttleSchedule()
  const [tick, setTick] = useState(0)
  const [activeCampus, setActiveCampus] = useState('main')

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
  void tick

  const directions = schedule?.directions ?? []

  const availableCampuses = useMemo(() => {
    const set = new Set(directions.map((d) => campusOf(d.direction)))
    const ordered = []
    if (set.has('main')) ordered.push('main')
    if (set.has('second')) ordered.push('second')
    return ordered
  }, [directions])

  const effectiveCampus = availableCampuses.includes(activeCampus)
    ? activeCampus
    : availableCampuses[0] ?? 'main'

  const info = {
    station: { pair: [null, null], times: [] },
    school:  { pair: [null, null], times: [] },
    station2:{ pair: [null, null], times: [] },
    school2: { pair: [null, null], times: [] },
  }
  for (const dir of directions) {
    const key = DIR_KEY[dir.direction]
    if (key) {
      const times = dir.times ?? []
      info[key] = { pair: findNextTwo(times), times }
    }
  }

  const pair = CAMPUS_PAIRS[effectiveCampus]

  return (
    <div className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden border border-slate-200 dark:border-border-dark shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-border-dark gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bus size={16} strokeWidth={2} className="text-navy dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-bold text-navy dark:text-blue-300">셔틀버스</span>
          {schedule && (
            <span className="text-xs text-slate-400 truncate">{schedule.schedule_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {availableCampuses.length > 1 && (
            <div className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
              {availableCampuses.map((key) => {
                const active = key === effectiveCampus
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCampus(key)}
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full transition-colors
                      ${active
                        ? 'bg-white dark:bg-slate-700 text-navy dark:text-blue-300 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    {CAMPUS_META[key].label}
                  </button>
                )
              })}
            </div>
          )}
          <button
            onClick={() => onOpenSheet(null)}
            className="text-xs text-blue-500 font-semibold hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
          >
            전체보기 ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-6 text-center text-slate-400 text-sm">불러오는 중...</div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-700">
          <TimeCell
            label={pair.left.label}  Icon={pair.left.Icon}
            pair={info[pair.left.key].pair}  times={info[pair.left.key].times}
            onClick={() => onOpenSheet(KEY_DIR[pair.left.key])}
          />
          <TimeCell
            label={pair.right.label} Icon={pair.right.Icon}
            pair={info[pair.right.key].pair} times={info[pair.right.key].times}
            onClick={() => onOpenSheet(KEY_DIR[pair.right.key])}
          />
        </div>
      )}
    </div>
  )
}
