// 날씨 아이콘과 달로 배경 장면을 고른다. 비, 눈이 계절보다 우선이다.
export const SCENES = ['spring', 'summer', 'autumn', 'winter', 'rain', 'snow']

export function sceneOf(icon, date = new Date()) {
  if (icon === 'rainy') return 'rain'
  if (icon === 'snowy') return 'snow'
  const m = date.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

const ALT = {
  spring: '파란 하늘 아래 벚꽃',
  summer: '뭉게구름이 뜬 여름 하늘',
  autumn: '떨어진 붉은 단풍잎',
  winter: '서리 내린 침엽수 산비탈',
  rain: '빗방울 맺힌 창 너머 젖은 길',
  snow: '검은 배경 위 눈 결정',
}

export const sceneAlt = (scene) => ALT[scene]

const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i))

/** 장면별 입자. 위치와 속도는 결정적이라 렌더마다 같다. */
export function particlesOf(scene) {
  if (scene === 'rain')
    return range(30, (i) => ({
      kind: 'rain',
      left: `${(i * 29.3) % 100}%`,
      size: `${36 + ((i * 13) % 40)}px`,
      dur: `${0.55 + (i % 5) * 0.09}s`,
      delay: `${-((i * 0.17) % 1.2)}s`,
    }))
  if (scene === 'snow')
    return range(32, (i) => ({
      kind: i % 3 === 0 ? 'snow far' : 'snow',
      left: `${(i * 37.7) % 100}%`,
      size: `${i % 3 === 0 ? 2 : 3 + (i % 3)}px`,
      dur: `${i % 3 === 0 ? 13 : 7 + (i % 5)}s`,
      delay: `${-((i * 0.83) % 12)}s`,
    }))
  if (scene === 'spring')
    return range(12, (i) => ({
      kind: 'petal',
      left: `${(i * 41.3 + 10) % 100}%`,
      size: `${8 + (i % 3) * 2}px`,
      dur: `${10 + (i % 4) * 2}s`,
      delay: `${-((i * 1.7) % 14)}s`,
    }))
  if (scene === 'autumn')
    return range(14, (i) => ({
      kind: `leaf c${i % 4}`,
      left: `${(i * 43.7 + 6) % 100}%`,
      size: `${12 + (i % 4) * 3}px`,
      dur: `${8 + (i % 5) * 1.6}s`,
      delay: `${-((i * 1.3) % 12)}s`,
    }))
  return []
}
