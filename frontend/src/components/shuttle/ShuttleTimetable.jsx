import { useRef, useEffect } from 'react'

function toMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

// note === '수시운행'인 연속 항목을 하나의 밴드로 묶어 display 목록을 생성
function buildDisplayList(times) {
  const result = []
  let i = 0
  while (i < times.length) {
    if (times[i].note === '수시운행') {
      let j = i
      while (j < times.length && times[j].note === '수시운행') j++
      result.push({
        type: 'frequent',
        key: `frequent-${times[i].depart_at}`,
        startTime: times[i].depart_at,
        endTime: times[j - 1].depart_at,
        startMin: toMinutes(times[i].depart_at),
        endMin: toMinutes(times[j - 1].depart_at),
      })
      i = j
    } else {
      result.push({
        type: 'fixed',
        key: times[i].depart_at,
        time: times[i].depart_at,
        minutes: toMinutes(times[i].depart_at),
        note: times[i].note ?? null,
      })
      i++
    }
  }
  return result
}

export default function ShuttleTimetable({ times }) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nextRef = useRef(null)

  const displayList = buildDisplayList(times)

  // 첫 번째 아직 지나지 않은 항목 인덱스
  const nextIndex = displayList.findIndex((item) => {
    if (item.type === 'fixed') return item.minutes > nowMinutes
    // frequent: 종료 시각이 아직 지나지 않으면 "다음"으로 취급
    return item.endMin > nowMinutes
  })

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [nextIndex])

  return (
    <ul className="flex-1 overflow-y-auto bg-white pb-28 md:pb-0">
      {displayList.map((item, i) => {
        const isNext = i === nextIndex

        if (item.type === 'frequent') {
          const isActive = nowMinutes >= item.startMin && nowMinutes <= item.endMin
          const isPast = item.endMin < nowMinutes

          return (
            <li
              key={item.key}
              ref={isNext ? nextRef : null}
              className={`flex items-center justify-between px-5 py-3 border-b border-slate-100
                ${isPast ? 'opacity-35 pointer-events-none' : ''}
                ${isActive || isNext ? 'bg-blue-50' : ''}`}
            >
              <div>
                <span className={`time-num text-lg font-semibold ${isActive || isNext ? 'text-navy' : 'text-slate-800'}`}>
                  {item.startTime} – {item.endTime}
                </span>
                <span className="ml-2 text-base text-slate-500">수시운행</span>
              </div>
              {(isActive || isNext) && (
                <span className="text-sm font-bold text-navy border border-navy px-2 py-1 rounded">
                  {isActive ? '운행 중' : '다음'}
                </span>
              )}
            </li>
          )
        }

        // type === 'fixed'
        const isPast = item.minutes < nowMinutes
        const isReturn = item.note?.startsWith('회차편')
        const schoolTime = isReturn
          ? (item.note.match(/학교 (\d{2}:\d{2}) 출발/)?.[1] ?? null)
          : null

        return (
          <li
            key={item.key}
            ref={isNext ? nextRef : null}
            className={`flex items-center justify-between px-5 py-3 border-b border-slate-100
              ${isPast ? 'opacity-35 pointer-events-none' : ''}
              ${isNext ? 'bg-blue-50' : ''}`}
          >
            {isReturn ? (
              <div>
                <p className={`text-sm text-slate-400`}>회차편</p>
                <p className={`text-sm font-medium mt-0.5 leading-snug ${isNext ? 'text-navy' : 'text-slate-600'}`}>
                  {schoolTime
                    ? `${schoolTime}에 출발 후 도착하는 버스가 회차하면 탑승하세요`
                    : '수시운행(17:00~18:00) 버스가 회차하면 탑승하세요'}
                </p>
              </div>
            ) : (
              <div>
                <span className={`time-num text-lg font-semibold ${isNext ? 'text-navy' : 'text-slate-800'}`}>
                  {item.time}
                </span>
                {item.note && (
                  <span className="ml-2 text-sm text-slate-400">{item.note}</span>
                )}
              </div>
            )}
            {isNext && (
              <span className="text-sm font-bold text-navy border border-navy px-2 py-1 rounded">
                다음
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
