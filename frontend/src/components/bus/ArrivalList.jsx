import BusArrivalCard from './BusArrivalCard'

export default function ArrivalList({ arrivals, onTimetableClick }) {
  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <p className="text-base text-slate-400">도착 정보가 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
      <div className="p-4 space-y-3">
        {arrivals.map((arrival, i) => (
          <BusArrivalCard
            key={`${arrival.route_no}-${i}`}
            arrival={arrival}
            onTimetableClick={onTimetableClick}
          />
        ))}
      </div>
    </div>
  )
}
