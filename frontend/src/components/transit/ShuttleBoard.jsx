import { CalendarClock, Clock, Repeat } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import { navigate } from '../../lib/nav'
import Segmented from '../kit/Segmented'
import { Card, SectionLabel, Skeleton } from '../kit/bits'
import { clockToMinutes, minutesLabel, nowMinutes } from './format'
import { SHUTTLE_DIRS, shuttleTimes, useShuttleDirection } from './shuttle'

export default function ShuttleBoard() {
  const dir = useShuttleDirection()
  const setDir = useAppStore((s) => s.setShuttleDirection)
  const { data: next, loading } = useShuttleNext(dir)
  const { data: schedule, loading: sLoading } = useShuttleSchedule(dir)
  const times = shuttleTimes(schedule, dir)
  const nowMin = nowMinutes()
  const remaining = times.filter((t) => (clockToMinutes(t.depart_at) ?? -1) >= nowMin)
  const continuous = remaining.find((t) => t.note?.includes('수시'))
  const noService = !sLoading && times.length === 0

  return (
    <section aria-label="셔틀">
      <Segmented
        className="mt-3"
        label="셔틀 방향"
        value={dir}
        onChange={setDir}
        options={SHUTTLE_DIRS.map((d) => ({ value: d.value, label: `${d.label}  ${d.desc}` }))}
      />

      {noService ? (
        <NoService holiday={schedule?.holiday_name} dir={dir} />
      ) : (
        <>
          <Card className="mt-4 p-5">
            <p className="text-f15 font-extrabold text-ink-2">다음 출발</p>
            {loading && !next ? (
              <Skeleton className="mt-2 h-14 w-40" />
            ) : next ? (
              <>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-f56 font-extrabold leading-none tracking-tight tabular-nums text-ink">{next.depart_at.slice(0, 5)}</span>
                  <span className="text-f20 font-extrabold text-amber-700 dark:text-amber-400">{minutesLabel(next.arrive_in_seconds)} 뒤</span>
                </div>
                <p className="mt-2 text-f16 font-bold text-ink">
                  {dir === 0 ? '정왕역 출발, 학교행' : '학교 출발, 정왕역행'}
                  {next.is_last && <span className="ml-2 rounded bg-imminent-bg px-1.5 text-f13 text-amber-900 dark:text-amber-200">막차</span>}
                </p>
              </>
            ) : (
              <p className="mt-2 text-f18 font-extrabold text-ink-2">오늘 운행이 끝났어요</p>
            )}
          </Card>

          {continuous && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-accent-bg px-4 py-3 text-f16 font-extrabold text-accent-ink">
              <Repeat size={18} aria-hidden="true" />
              {continuous.depart_at.slice(0, 5)} {continuous.note}
            </div>
          )}

          {remaining.length > 0 && (
            <>
              <SectionLabel Icon={Clock}>오늘 남은 출발</SectionLabel>
              <div className="flex flex-wrap gap-2 px-1 text-f17 font-bold tabular-nums">
                {remaining.slice(0, 8).map((t, i) => (
                  <span
                    key={t.depart_at + i}
                    className={`rounded-xl px-2.5 py-1.5 ${
                      i === 0 ? 'bg-accent-bg font-extrabold text-accent-ink ring-1 ring-accent' : i === remaining.length - 1 ? 'bg-imminent-bg text-amber-900 dark:text-amber-200' : 'text-ink'
                    }`}
                  >
                    {t.depart_at.slice(0, 5)}
                    {i === remaining.length - 1 && ' 막차'}
                  </span>
                ))}
              </div>
            </>
          )}
          <TimetableButton dir={dir} />
        </>
      )}
    </section>
  )
}

function TimetableButton({ dir }) {
  return (
    <button
      type="button"
      onClick={() => navigate(`/transit/shuttle/timetable?dir=${dir}`)}
      className="mt-5 flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-f16 font-extrabold text-ink"
    >
      <CalendarClock size={18} aria-hidden="true" />
      시간표 보기
    </button>
  )
}

function NoService({ holiday, dir }) {
  return (
    <div className="mt-4 rounded-3xl bg-surface-2 p-5">
      <p className="text-f22 font-extrabold text-ink">오늘은 셔틀이 없어요</p>
      {holiday && <p className="mt-1 text-f16 font-bold text-ink">{holiday}</p>}
      <TimetableButton dir={dir} />
    </div>
  )
}
