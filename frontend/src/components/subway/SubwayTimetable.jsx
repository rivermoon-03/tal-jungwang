import { useRef, useEffect } from 'react'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

export default function SubwayTimetable({ entries, nextIndex, lineColor, lineLightColor }) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nextRef = useRef(null)

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [nextIndex])

  return (
    <ul className="flex-1 overflow-y-auto bg-white pb-16 md:pb-0">
      {entries.map((train, i) => {
        const isPast = timeToMinutes(train.depart_at) <= nowMin
        const isNext = i === nextIndex
        const diffMin = Math.round(timeToMinutes(train.depart_at) - nowMin)

        return (
          <li
            key={i}
            ref={isNext ? nextRef : null}
            className={`flex items-center px-5 py-3 border-b border-slate-100
              ${isPast ? 'opacity-35 pointer-events-none' : ''}`}
            style={isNext ? { backgroundColor: lineLightColor } : {}}
          >
            <span
              className="time-num text-lg font-semibold min-w-[56px]"
              style={isNext ? { color: lineColor } : { color: '#1e293b' }}
            >
              {train.depart_at}
            </span>
            <span className="flex-1 text-base text-slate-500 ml-3">{train.destination}행</span>
            {isNext && (
              <span className="text-base font-bold" style={{ color: lineColor }}>
                {diffMin}분 후
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
