import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import StatusChip from '../ui/StatusChip'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

export default function SubwayTimetable({ entries, nextIndex, lastIdx, firstIdx, lineColor, lineDarkColor, lineLightColor }) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const darkMode = useAppStore((s) => s.darkMode)

  // entries 의 depart_at 을 분 단위로 미리 변환해 캐싱.
  // entries reference 가 안 바뀌면 재계산 안 함 (timeToMinutes 매 렌더 호출 회피).
  const departMinutes = useMemo(
    () => entries.map((train) => timeToMinutes(train.depart_at)),
    [entries],
  )

  // 이전 열차 2개 + 현재부터 표시 (스크롤 없이 리스트 자체가 현재 시각 근처에서 시작)
  const startIdx = nextIndex >= 0
    ? Math.max(0, nextIndex - 2)
    : Math.max(0, entries.length - 2)

  return (
    <ul className="flex-1 overflow-y-auto bg-surface dark:bg-bg-dark pb-28 md:pb-0">
      {entries.slice(startIdx).map((train, di) => {
        const i = di + startIdx
        const departMin = departMinutes[i]
        const isPast = departMin <= nowMin
        const isNext = i === nextIndex
        const isLast  = i === lastIdx
        const isFirst = i === firstIdx
        const diffMin = Math.round(departMin - nowMin)

        return (
          <li
            key={i}
            className={[
              'relative flex items-center px-5 py-3.5 border-b border-line dark:border-line-dark',
              isNext ? 'bg-accent-bg dark:bg-accent-bg/20' : '',
              isPast && !isNext ? 'pointer-events-none' : '',
            ].filter(Boolean).join(' ')}
          >
            <span
              className={[
                'tabular-nums min-w-[60px] tracking-tight text-label',
                isNext ? 'font-black text-ink dark:text-ink-dark' : 'font-bold',
                isPast && !isNext ? 'text-mute dark:text-mute-dark' : !isNext ? 'text-ink dark:text-ink-dark' : '',
              ].filter(Boolean).join(' ')}
            >
              {train.depart_at}
            </span>
            <span className={[
              'flex-1 text-label font-medium ml-3',
              isNext ? 'text-ink dark:text-ink-dark font-bold' : '',
              isPast && !isNext ? 'text-mute dark:text-mute-dark' : !isNext ? 'text-ink-2 dark:text-ink-2-dark' : '',
            ].filter(Boolean).join(' ')}>
              {train.destination}행
            </span>
            <div className="flex items-center gap-1.5">
              {isLast && (
                <StatusChip kind="last">막차</StatusChip>
              )}
              {isFirst && (
                <StatusChip kind="beta">첫차</StatusChip>
              )}
              {isNext && (
                <span className="text-label font-semibold tabular-nums text-ink-2 dark:text-ink-2-dark">
                  {diffMin}분 후
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
