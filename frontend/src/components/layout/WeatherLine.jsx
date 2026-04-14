/**
 * WeatherLine — 얇은 한 줄 날씨 요약
 * "{icon} {지역} · {하늘상태} {기온}° · {다음 시간대} {기온}°"
 */

const SKY_EMOJI = {
  sunny: '☀️',
  clear: '☀️',
  cloudy: '⛅',
  overcast: '☁️',
  rainy: '☔',
  snowy: '❄️',
  foggy: '🌫️',
}

function skyEmoji(icon, sky) {
  if (icon && SKY_EMOJI[icon]) return SKY_EMOJI[icon]
  if (!sky) return '🌤️'
  if (sky.includes('비')) return '☔'
  if (sky.includes('눈')) return '❄️'
  if (sky.includes('맑')) return '☀️'
  if (sky.includes('흐')) return '☁️'
  return '🌤️'
}

export default function WeatherLine({ weather }) {
  if (!weather) return null

  const { currentTemp, currentSky, icon, timeBucket } = weather
  const emoji = skyEmoji(icon, currentSky)
  const sky = currentSky ?? ''
  const temp = typeof currentTemp === 'number' ? currentTemp : '–'
  const nextLabel = timeBucket?.nextLabel ?? ''
  const nextTemp = timeBucket?.nextTemp ?? null

  return (
    <p className="text-[10.5px] text-gray-500 dark:text-gray-400 leading-tight tracking-tight truncate">
      {emoji} 정왕 · {sky} {temp}°
      {nextLabel && nextTemp !== null && (
        <> · {nextLabel} {nextTemp}°</>
      )}
    </p>
  )
}
