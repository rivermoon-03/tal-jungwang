import { tjLineColor } from '../common/lineColor'

const LIGHT_LINES = ['수인분당', '서해선']

export function lineBadgeColors(route) {
  const light = LIGHT_LINES.some((k) => String(route ?? '').includes(k))
  return { bg: tjLineColor(route), fg: light ? '#1a211e' : '#ffffff' }
}
