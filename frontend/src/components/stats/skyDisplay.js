/**
 * 하늘 상태(sky) 코드의 아이콘·한글 표기 매핑.
 *
 * WeatherCard와 홈 히어로, PC 사이드바 요약이 같은 표기를 쓰도록 한곳에 둔다.
 * 컴포넌트 파일에서 분리해야 fast refresh가 동작한다.
 */
import { Sun, Cloud, CloudSun, CloudRain, CloudSnow } from 'lucide-react'

export const SKY_ICON = {
  sunny:         Sun,
  partly_cloudy: CloudSun,
  cloudy:        Cloud,
  rainy:         CloudRain,
  snowy:         CloudSnow,
}

export const SKY_TEXT = {
  sunny:         '맑음',
  partly_cloudy: '구름많음',
  cloudy:        '흐림',
  rainy:         '비',
  snowy:         '눈',
}
