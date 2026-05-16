import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'

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
        const accent = darkMode ? (lineDarkColor ?? lineColor) : lineColor

        return (
          <li
            key={i}
            className={`relative flex items-center px-5 py-3.5 border-b border-line dark:border-line-dark
              ${isPast ? 'opacity-35 pointer-events-none' : ''}`}
            style={isNext ? { backgroundColor: darkMode ? 'rgba(30,41,59,0.8)' : lineLightColor } : {}}
          >
            {isNext && (
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: accent }} />
            )}
            <span
              className={`tabular-nums min-w-[60px] tracking-tight ${isNext ? 'text-eta-mob font-black' : 'text-eta-mob font-bold text-ink dark:text-ink-dark'}`}
              style={isNext ? { color: accent } : undefined}
            >
              {train.depart_at}
            </span>
            <span className={`flex-1 text-meta font-medium ml-3 ${isNext ? 'text-text dark:text-text-dark font-bold' : 'text-mute dark:text-mute-dark'}`}>{train.destination}행</span>
            <div className="flex items-center gap-1.5">
              {isLast && (
                <span className="text-micro font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
                  막차
                </span>
              )}
              {isFirst && (
                <span className="text-micro font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
                  첫차
                </span>
              )}
              {isNext && (
                <span className="text-panel-ttl tracking-tight" style={{ color: accent }}>
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
