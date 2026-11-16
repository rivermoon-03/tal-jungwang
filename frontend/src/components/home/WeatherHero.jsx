import { CloudFog, Droplets, MapPin, Wind } from 'lucide-react'
import { particlesOf, sceneAlt } from './weatherScene'
import './weather.css'

// 장면별 사진 보정. 움직이는 필터(여름 아지랑이, 비 굴절)는 data-paused 일 때 SVG 애니메이션도 멈춘다.
function Filters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <filter id="tjf-spring" x="0" y="0" width="100%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="soft" />
          <feColorMatrix in="soft" type="matrix" values="0.55 0 0 0 0  0 0.5 0 0 0  0 0 0.55 0 0  0 0 0 1 0" result="glow" />
          <feBlend in="SourceGraphic" in2="glow" mode="screen" />
        </filter>
        <filter id="tjf-summer" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.03" numOctaves="1" seed="4" result="haze">
            <animate attributeName="baseFrequency" values="0.006 0.03;0.007 0.034;0.006 0.03" dur="7s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="haze" scale="5" xChannelSelector="R" yChannelSelector="G" result="wavy" />
          <feColorMatrix in="wavy" type="saturate" values="1.25" />
        </filter>
        <filter id="tjf-autumn" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="1.15" result="sat" />
          <feComponentTransfer in="sat">
            <feFuncR type="linear" slope="1.1" intercept="0.02" />
            <feFuncB type="linear" slope="0.82" />
          </feComponentTransfer>
        </filter>
        <filter id="tjf-winter" x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="saturate" values="0.35" result="cold" />
          <feComponentTransfer in="cold">
            <feFuncR type="linear" slope="0.94" />
            <feFuncB type="linear" slope="1.08" intercept="0.03" />
          </feComponentTransfer>
        </filter>
        <filter id="tjf-rain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.07" numOctaves="2" seed="7" result="glass">
            <animate attributeName="baseFrequency" values="0.018 0.07;0.02 0.078;0.018 0.07" dur="5s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="glass" scale="16" xChannelSelector="R" yChannelSelector="B" result="wet" />
          <feColorMatrix in="wet" type="saturate" values="0.6" />
        </filter>
        <filter id="tjf-snow" x="0" y="0" width="100%" height="100%">
          <feGaussianBlur stdDeviation="0.8" result="hush" />
          <feColorMatrix in="hush" type="saturate" values="0.5" />
        </filter>
      </defs>
    </svg>
  )
}

/** 사진, 입자, 덮개. 높이는 부모가 정한다. */
export function WeatherBackdrop({ scene, height, still = false }) {
  const particles = still ? [] : particlesOf(scene)
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height }} aria-hidden="true">
      <Filters />
      <img
        src={`/weather/${scene}.webp`}
        alt=""
        width="540"
        height="720"
        fetchPriority="high"
        decoding="async"
        className="tjw-photo h-full w-full object-cover"
        style={{ filter: still ? undefined : `url(#tjf-${scene})` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, rgba(16,18,17,.82) 0%, rgba(16,18,17,.7) 45%, rgba(16,18,17,.6) 62%, rgba(16,18,17,.92) 82%, #101211 100%)' }}
      />
      {particles.map((p, i) => (
        <span
          key={i}
          className={`tjw-p ${p.kind}`}
          style={{ left: p.left, width: p.kind === 'rain' ? undefined : p.size, height: p.size, animationDuration: p.dur, animationDelay: p.delay }}
        />
      ))}
    </div>
  )
}

/** 지금 날씨 블록. 기온, 하늘, 강수, 바람, 미세먼지 */
export function WeatherNow({ weather, scene, timeLabel, compact = false }) {
  const temp = weather?.currentTemp
  return (
    <div className="text-[#eceeed] [text-shadow:0_1px_3px_rgba(0,0,0,.45)]">
      <p className="sr-only">{sceneAlt(scene)}</p>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-f16 font-bold">
          <MapPin size={16} aria-hidden="true" />
          정왕동
        </span>
        <span className="text-f14 text-[#adb5b2] tabular-nums">{timeLabel}</span>
      </div>
      <div className={`flex items-end gap-3 ${compact ? 'mt-2' : 'mt-5'}`}>
        <span className={`${compact ? 'text-f72' : 'text-f96'} font-light leading-[0.9] tracking-[-0.09em]`}>
          {temp != null ? `${temp}°` : '--°'}
        </span>
        <span className="pb-2 text-f22 font-extrabold">{weather?.currentSky ?? ''}</span>
      </div>
      <dl className={`grid grid-cols-[22px_72px_1fr] items-center gap-y-2 text-f16 ${compact ? 'mt-3' : 'mt-5'}`}>
        <Droplets size={16} className="text-[#adb5b2]" aria-hidden="true" />
        <dt className="text-[#adb5b2]">강수</dt>
        <dd className="font-bold">{weather?.rainProb != null ? `${weather.rainProb}%` : '정보 없음'}</dd>
        <Wind size={16} className="text-[#adb5b2]" aria-hidden="true" />
        <dt className="text-[#adb5b2]">바람</dt>
        <dd className="font-bold">{weather?.windSpeed != null ? `${weather.windSpeed}m/s` : '정보 없음'}</dd>
        <CloudFog size={16} className="text-[#adb5b2]" aria-hidden="true" />
        <dt className="text-[#adb5b2]">미세먼지</dt>
        <dd className="font-bold">{weather?.pm10Grade && weather.pm10Grade !== '알수없음' ? weather.pm10Grade : '정보 없음'}</dd>
      </dl>
    </div>
  )
}
