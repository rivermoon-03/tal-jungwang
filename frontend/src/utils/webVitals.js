/**
 * 실사용자 Core Web Vitals(CLS/INP/LCP/FCP/TTFB) 측정.
 * 운영에서는 /api/v1/vitals 로 보내 Prometheus 히스토그램(tj_web_vitals_*)에 쌓는다.
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals'

const ENDPOINT = '/api/v1/vitals'

export function pageOf(pathname) {
  if (pathname === '/') return 'home'
  for (const p of ['transit', 'cafeteria', 'more']) if (pathname.startsWith(`/${p}`)) return p
  return 'other'
}

function report(metric) {
  if (import.meta.env.DEV) {
    console.debug(`[web-vitals] ${metric.name}`, Math.round(metric.value), metric.rating)
    return
  }
  const body = JSON.stringify({ name: metric.name, value: metric.value, page: pageOf(window.location.pathname) })
  // 페이지를 떠나는 순간에도 보내지도록 sendBeacon 을 먼저 쓴다.
  const sent = navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: 'application/json' }))
  if (!sent) fetch(ENDPOINT, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
}

export function initWebVitals() {
  onCLS(report)
  onINP(report)
  onLCP(report)
  onFCP(report)
  onTTFB(report)
}
