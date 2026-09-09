import { Fragment } from 'react'
import { ROUTE_WAYPOINTS } from '../dashboard/busStationConfig'

/**
 * RouteProgressStrip — 노선 경유 진행 표시 바.
 * 현재 정류장이 노선의 어디쯤인지 점과 선으로 보여준다.
 */
export default function RouteProgressStrip({ routeNo, stationId, hasArrival }) {
  const waypoints = ROUTE_WAYPOINTS[routeNo]
  if (!waypoints) return null

  const activeSegIdx = hasArrival ? waypoints.findIndex((w) => w.id === stationId) : -1

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start">
        <div className="mt-[6px] w-3 shrink-0 h-px bg-line dark:bg-line" />
        {waypoints.map((wp, i) => (
          <Fragment key={wp.id}>
            <div className="relative flex-1 flex items-center mt-[6px]">
              <div className={`w-full h-px ${activeSegIdx === i ? 'bg-accent' : 'bg-line dark:bg-line'}`} />
              {activeSegIdx === i && (
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent shadow" />
              )}
            </div>
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-3 h-3 rounded-full border-2 ${wp.id === stationId ? 'border-accent bg-surface dark:bg-surface' : 'border-line-strong dark:border-line-strong bg-surface dark:bg-bg'}`} />
              <span className={`text-meta mt-0.5 whitespace-nowrap leading-tight ${wp.id === stationId ? 'font-bold text-accent' : 'text-mute dark:text-mute'}`}>
                {wp.label}
              </span>
            </div>
          </Fragment>
        ))}
        <div className="flex-1 mt-[6px] h-px bg-line dark:bg-line" />
      </div>
    </div>
  )
}
