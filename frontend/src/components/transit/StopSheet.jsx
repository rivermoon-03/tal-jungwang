import { Check } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { BUS_STATIONS, BUS_STATION_LABELS, getBusStationDisplay } from './busStationConfig'
import BottomSheet from '../kit/BottomSheet'

/** 정류장 고르기. 정류장마다 방면이 하나라 고르면 바로 닫는다. */
export default function StopSheet({ open, onClose }) {
  const station = useAppStore((s) => s.selectedBusStation)
  const setBusStation = useAppStore((s) => s.setBusStation)
  const setBusDirection = useAppStore((s) => s.setBusDirection)
  const setAutoMode = useAppStore((s) => s.setBusStationAutoMode)

  const pick = (id) => {
    setBusStation(id)
    setBusDirection(BUS_STATIONS[id].defaultDirection)
    setAutoMode(false)
    onClose()
  }

  return (
    <BottomSheet open={open} title="어디서 타나요" onClose={onClose}>
      <ul>
        {BUS_STATION_LABELS.map((id) => {
          const conf = BUS_STATIONS[id]
          const on = id === station
          const routes = Object.keys(conf.perRouteDisplay)
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => pick(id)}
                aria-current={on}
                className={`flex min-h-16 w-full items-center gap-3 border-b border-line-soft px-3 text-left ${on ? 'rounded-xl bg-surface-2' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-f17 font-extrabold text-ink">
                    {getBusStationDisplay(id)} <span className="text-f14 font-bold text-accent-ink">{conf.defaultDirection}</span>
                  </p>
                  <p className="truncate text-f13 text-mute">
                    {routes.slice(0, 4).join(', ')}
                    {routes.length > 4 ? ` 외 ${routes.length - 4}` : ''}
                  </p>
                </div>
                {on && <Check size={20} className="text-accent" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
    </BottomSheet>
  )
}
