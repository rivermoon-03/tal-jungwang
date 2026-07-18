/**
 * webVitals.js — 실사용자 Core Web Vitals(CLS/INP/LCP/FCP/TTFB) 측정.
 *
 * F7(라이브러리 도입) 1단계: 저사양 모바일 실측을 위해 web-vitals(런타임 ~2KB)만 우선
 * 도입한다. 백엔드로 전송하는 파이프라인은 아직 없음 — 지금은 개발 중 콘솔로만
 * 확인하고, 실사용자 집계가 필요해지면 별도 엔드포인트를 추가해 연결한다(범위 밖).
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals'

function report(metric) {
  if (import.meta.env.DEV) {
    console.debug(`[web-vitals] ${metric.name}`, Math.round(metric.value), metric.rating)
  }
}

export function initWebVitals() {
  onCLS(report)
  onINP(report)
  onLCP(report)
  onFCP(report)
  onTTFB(report)
}
