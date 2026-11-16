import { useWeather } from '../../hooks/useWeather'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { useNow } from '../../hooks/useNow'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { linkProps } from '../../lib/nav'
import { sceneOf } from './weatherScene'
import { isLowEnd, useWeatherMotion } from './useWeatherMotion'
import { WeatherBackdrop, WeatherNow } from './WeatherHero'
import { BusCard, MealCard, ShuttleCard, SubwayCard } from './HomeCards'
import BusBoard from '../transit/BusBoard'
import SubwayBoard from '../transit/SubwayBoard'
import ShuttleBoard from '../transit/ShuttleBoard'

const LOW_END = isLowEnd()
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

function timeLabel(now) {
  const d = new Date(now)
  return `${WEEKDAY[d.getDay()]}요일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function HomePage() {
  const isDesktop = useIsDesktop()
  return isDesktop ? <HomeDesktop /> : <HomeMobile />
}

function HomeMobile() {
  const { weather } = useWeather()
  const { direction } = useEffectiveDirection()
  const now = useNow(30_000)
  const scene = sceneOf(weather?.icon, new Date(now))
  const hhmm = timeLabel(now).split(' ')[1]
  const motionRef = useWeatherMotion()

  return (
    <div ref={motionRef} className="tjw-root relative flex flex-1 flex-col bg-[#101211] pb-2">
      <WeatherBackdrop scene={scene} height={520} still={LOW_END} />
      <div className="relative px-[22px] pt-6">
        <WeatherNow weather={weather} scene={scene} timeLabel={timeLabel(now)} />
      </div>
      {/* 화면이 높으면 카드가 독 바로 위로 내려가고, 낮으면 날씨 바로 아래에 붙는다. */}
      <section aria-label="지금 기준 교통과 학식" className="relative mt-auto flex flex-col gap-2.5 px-3.5 pt-6">
        <div className="flex items-baseline justify-between px-2">
          <span className="text-f14 font-bold text-[#adb5b2]">
            {hhmm} {direction}
          </span>
          <a {...linkProps('/transit')} className="text-f14 font-bold text-[#12a594]">
            교통 전체
          </a>
        </div>
        <BusCard />
        <div className="grid grid-cols-2 gap-2.5">
          <SubwayCard direction={direction} />
          <MealCard />
        </div>
        <ShuttleCard direction={direction} />
      </section>
    </div>
  )
}

function HomeDesktop() {
  const { weather } = useWeather()
  const now = useNow(30_000)
  const scene = sceneOf(weather?.icon, new Date(now))
  const motionRef = useWeatherMotion()
  return (
    <div className="pb-10">
      <div ref={motionRef} className="tjw-root relative h-[240px] overflow-hidden bg-[#101211]">
        <WeatherBackdrop scene={scene} height={240} still={LOW_END} />
        <div className="relative mx-auto max-w-[1200px] px-8 pt-5">
          <WeatherNow weather={weather} scene={scene} timeLabel={timeLabel(now)} compact />
        </div>
      </div>
      <div className="mx-auto grid max-w-[1200px] grid-cols-3 gap-6 px-8 pt-4">
        <BusBoard />
        <SubwayBoard />
        <div className="flex flex-col gap-3">
          <ShuttleBoard />
          <div className="pt-2">
            <MealCard />
          </div>
        </div>
      </div>
    </div>
  )
}
