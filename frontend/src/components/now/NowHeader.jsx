// frontend/src/components/now/NowHeader.jsx
import { CloudSun } from 'lucide-react'
import { useWeather } from '../../hooks/useWeather'
import GreetingText from './GreetingText'

function WeatherBlock() {
  const { weather } = useWeather()
  const temp = weather?.currentTemp
  return (
    <div className="flex flex-col items-end leading-tight">
      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
        <CloudSun size={16} strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[11px] font-medium">정왕동</span>
      </div>
      <div
        className="font-sans text-slate-900 dark:text-slate-100 tabular-nums"
        style={{ fontSize: 18, fontWeight: 700 }}
      >
        {temp != null ? `${Math.round(temp)}°` : '–'}
      </div>
    </div>
  )
}

export default function NowHeader() {
  return (
    <header className="flex items-start justify-between px-5 pt-4 pb-2">
      <div className="flex-1 min-w-0">
        <GreetingText />
      </div>
      <div className="pl-4 shrink-0">
        <WeatherBlock />
      </div>
    </header>
  )
}
