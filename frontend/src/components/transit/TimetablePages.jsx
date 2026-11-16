import { useApi } from '../../hooks/useApi'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import PageHeader from '../kit/PageHeader'
import LineBadge from '../kit/LineBadge'
import Segmented from '../kit/Segmented'
import HourRows from '../kit/HourRows'
import { Banner, Skeleton } from '../kit/bits'
import useAppStore from '../../stores/useAppStore'
import { findDir } from './subwayConfig'
import { nowMinutes } from './format'
import { SHUTTLE_DIRS, shuttleTimes } from './shuttle'

export function SubwayTimetablePage({ dirKey }) {
  const dir = findDir(dirKey)
  const { data, loading, error } = useApi('/subway/timetable', { ttl: 30 * 60_000 })
  if (!dir) return <Banner kind="error" title="없는 방면이에요" />
  const list = data?.[dirKey] ?? []
  const times = list.map((t) => t.depart_at)
  const destOf = Object.fromEntries(list.map((t) => [t.depart_at, t.destination]))
  const initials = [...new Set(list.map((t) => t.destination))].filter(Boolean)
  const legend = initials.length > 1 ? initials.map((d) => `${d[0]} ${d}`).join('   ') : null

  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route={dir.line} />} title={`${dir.station}, ${dir.label}`} fallback="/transit" />
      <div className="px-4">
        {legend && <p className="px-1 pt-3 text-f13 text-ink-2">{legend}</p>}
        <div className="mt-2">
          {loading && !data ? (
            <Skeleton className="h-64" />
          ) : error ? (
            <Banner kind="error" title="시간표를 불러오지 못했어요" />
          ) : (
            <HourRows
              times={times}
              nowMin={nowMinutes()}
              tagOf={initials.length > 1 ? (raw) => destOf[raw]?.[0] : undefined}
              lastRaw={times[times.length - 1]}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export function ShuttleTimetablePage({ dir: initialDir }) {
  const stored = useAppStore((s) => s.shuttleDirection)
  const setDir = useAppStore((s) => s.setShuttleDirection)
  const dir = stored ?? initialDir ?? 1
  const { data, loading, error } = useShuttleSchedule(dir)
  const list = shuttleTimes(data, dir)
  const times = list.map((t) => t.depart_at.slice(0, 5))
  const noteOf = Object.fromEntries(list.map((t) => [t.depart_at.slice(0, 5), t.note]))

  return (
    <div className="mx-auto w-full max-w-[560px] pb-8">
      <PageHeader leading={<LineBadge route="셔틀" />} title="셔틀 시간표" sub={data?.schedule_name} fallback="/transit" />
      <div className="px-4">
        <Segmented
          className="mt-3"
          label="셔틀 방향"
          value={dir}
          onChange={setDir}
          options={SHUTTLE_DIRS.map((d) => ({ value: d.value, label: `${d.label}  ${d.desc}` }))}
        />
        <div className="mt-2">
          {loading && !data ? (
            <Skeleton className="h-64" />
          ) : error ? (
            <Banner kind="error" title="시간표를 불러오지 못했어요" />
          ) : (
            <HourRows
              times={times}
              nowMin={nowMinutes()}
              tagOf={(raw) => (noteOf[raw]?.includes('수시') ? '수시' : noteOf[raw]?.includes('회차') ? '회' : null)}
              lastRaw={times[times.length - 1]}
            />
          )}
        </div>
      </div>
    </div>
  )
}
