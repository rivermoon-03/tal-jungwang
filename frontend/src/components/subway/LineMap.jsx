import { TrainFront } from 'lucide-react'

export default function LineMap({ stations, jeongwangIndex, direction, currentSeconds }) {
  // Train position visualization — no live train data yet (mock: no position shown)
  const posPercent = null

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">
        수인분당선 — 열차 위치 추정
      </p>
      <div className="relative h-10 flex items-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-slate-200 rounded" />

        {posPercent !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-[3px] bg-navy rounded"
            style={{ left: 0, width: `${posPercent}%` }}
          />
        )}

        {posPercent !== null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-5 bg-navy rounded-sm"
            style={{ left: `calc(${posPercent}% - 10px)` }}
          >
            <TrainFront size={11} color="white" strokeWidth={2} />
          </div>
        )}

        {stations.map((name, i) => {
          const isJeongwang = i === jeongwangIndex
          const leftPercent = (i / (stations.length - 1)) * 100
          const isPassed = posPercent !== null && leftPercent <= posPercent

          return (
            <div
              key={name}
              className="absolute flex flex-col items-center"
              style={{ left: `${leftPercent}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <div className={`rounded-full border-2 z-10
                ${isJeongwang
                  ? 'w-3.5 h-3.5 border-accent bg-white'
                  : isPassed
                    ? 'w-2.5 h-2.5 border-navy bg-navy'
                    : 'w-2.5 h-2.5 border-slate-400 bg-white'
                }`}
              />
              <span className={`absolute top-4 text-[9px] whitespace-nowrap
                ${isJeongwang ? 'font-bold text-accent' : 'text-slate-400'}`}>
                {name}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
