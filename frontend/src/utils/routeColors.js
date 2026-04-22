// frontend/src/utils/routeColors.js
// mode: 'city_bus' | 'wide_bus' | 'shuttle' | 'subway_k4' | 'subway_seohae'
// Resolver prefers explicit `mode` then falls back by route number / category.

export const ROUTE_COLORS = {
  city_bus:      { dark: '#5b9cf6', light: '#1d4ed8' },
  wide_bus:      { dark: '#f87171', light: '#dc2626' },
  shuttle:       { dark: '#34d399', light: '#059669' },
  subway_k4:     { dark: '#fbbf24', light: '#b45309' }, // 수인분당선
  subway_seohae: { dark: '#75bf43', light: '#4d7f2a' },
  fallback:      { dark: '#94a3b8', light: '#475569' },
}

// Known 광역버스 numbers in our corpus
const WIDE_BUS = new Set(['3400', '3401', '5200', '6502', '5602', '5601'])

export function resolveRouteMode({ mode, routeNumber, category } = {}) {
  if (mode) return mode
  if (category === '셔틀' || category === 'shuttle') return 'shuttle'
  if (routeNumber && WIDE_BUS.has(String(routeNumber))) return 'wide_bus'
  if (routeNumber) return 'city_bus'
  return 'fallback'
}

export function routeColor(input, theme = 'dark') {
  const mode = resolveRouteMode(input)
  return ROUTE_COLORS[mode]?.[theme] ?? ROUTE_COLORS.fallback[theme]
}
