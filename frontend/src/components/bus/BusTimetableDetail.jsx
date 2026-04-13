import { useRef, useEffect } from 'react'
import { ChevronLeft, BusFront } from 'lucide-react'
import { useBusTimetable } from '../../hooks/useBus'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

export default function BusTimetableDetail({ routeId, routeNo, onBack }) {
  const { data, loading } = useBusTimetable(routeId)
  const nextRef = useRef(null)

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const times = data?.times ?? []
  const nextIndex = times.findIndex((t) => timeToMinutes(t) > nowMin)

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [nextIndex, loading])

  return (
    <div className="flex flex-col h-full animate-slide-in-right">
      <div className="flex items-center gap-2 bg-navy text-white px-4 py-4">
        <button onClick={onBack} className="p-0.5 -ml-1 rounded">
          <ChevronLeft size={22} strokeWidth={2.5} />
        </button>
        <BusFront size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">{routeNo}번 시간표</h2>
        {data && (
          <span className="ml-auto text-sm opacity-75 capitalize">{data.schedule_type}</span>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">불러오는 중...</p>
        </div>
      ) : times.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-base text-slate-400">시간표 정보가 없습니다.</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto bg-white pb-16 md:pb-0">
          {times.map((t, i) => {
            const isPast = timeToMinutes(t) <= nowMin
            const isNext = i === nextIndex
            const diffMin = Math.round(timeToMinutes(t) - nowMin)

            return (
              <li
                key={i}
                ref={isNext ? nextRef : null}
                className={`flex items-center px-5 py-3 border-b border-slate-100
                  ${isPast ? 'opacity-35 pointer-events-none' : ''}
                  ${isNext ? 'bg-blue-50' : ''}`}
              >
                <span className={`time-num text-lg font-semibold min-w-[56px]
                  ${isNext ? 'text-navy' : 'text-slate-800'}`}>
                  {t}
                </span>
                {isNext && (
                  <span className="ml-auto text-base font-bold text-navy">{diffMin}분 후</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
