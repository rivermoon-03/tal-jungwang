import { useEffect, useRef } from 'react'
import { groupByHour } from '../transit/format'

/**
 * 시간표 공용 줄. times: "HH:MM" 목록, nowMin: 자정 기준 지금 분.
 * tagOf(raw) 로 분 옆 한 글자(종착역, 회차)를 붙인다. lastRaw 는 막차.
 */
export default function HourRows({ times, nowMin, tagOf, lastRaw }) {
  const rows = groupByHour(times)
  const nextTotal = rows.flatMap((r) => r.mins).map((m) => m.total).filter((t) => t >= nowMin).sort((a, b) => a - b)[0]
  const nowRef = useRef(null)

  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  if (!rows.length) return <p className="px-1 py-6 text-f15 text-ink-2">이 날은 운행하지 않아요</p>

  const nowHour = Math.floor(nowMin / 60)
  return (
    <div className="tj-cv-auto">
      {rows.map(({ hour, mins }) => {
        const isNowRow = hour === nowHour
        return (
          <div
            key={hour}
            ref={isNowRow ? nowRef : undefined}
            className={`flex gap-3 border-b border-line-soft py-2.5 ${isNowRow ? '-mx-2 rounded-xl bg-surface-2 px-2' : ''}`}
          >
            <b className={`w-8 flex-none pt-1 text-f16 tabular-nums ${hour < nowHour ? 'text-mute-2' : 'text-ink'}`}>
              {String(hour).padStart(2, '0')}
            </b>
            <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-f16 tabular-nums">
              {[...mins].sort((a, b) => a.min - b.min).map(({ min, total, raw }) => {
                const past = total < nowMin
                const next = total === nextTotal
                const last = raw === lastRaw
                const tag = tagOf?.(raw)
                const cls = next
                  ? 'rounded-lg bg-accent-bg font-extrabold text-accent-ink ring-1 ring-accent'
                  : last
                    ? 'rounded-lg bg-imminent-bg font-extrabold text-amber-900 dark:text-amber-200'
                    : past
                      ? 'text-mute-2'
                      : 'text-ink'
                return (
                  <span key={raw} className={`px-1.5 py-0.5 ${cls}`}>
                    {String(min).padStart(2, '0')}
                    {tag && <sup className="ml-0.5 text-f12 font-extrabold text-mute">{tag}</sup>}
                    {last && ' 막차'}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
