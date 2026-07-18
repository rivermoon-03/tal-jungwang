import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import { maybeLoadWebAds } from './utils/ads'
import { initWebVitals } from './utils/webVitals'

// React 마운트 전에 동기적으로 dark 클래스 설정 — useEffect 지연으로 인한 플래시 방지
if (localStorage.getItem('tal_dark') === '1') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

// dev에서는 SW를 등록하지 않는다 — /src/*.jsx 가 캐시되면 HMR 후에도 옛 코드가 고착됨.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => {
          if (nw.state === 'activated' && navigator.serviceWorker.controller) {
            window.location.reload()
          }
        })
      })
    }).catch(() => {/* 등록 실패는 무시 */})
  })
  navigator.serviceWorker.addEventListener('message', (ev) => {
    if (ev.data?.type === 'SW_UPDATED' && !sessionStorage.getItem('sw-reloaded')) {
      sessionStorage.setItem('sw-reloaded', '1')
      window.location.reload()
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* 즐겨찾기/알림 토글 등 피드백 없는 액션용 토스트(F7) — 다크모드는 앱 테마를 따라간다 */}
    <Toaster richColors position="top-center" theme="system" />
  </StrictMode>,
)

// 웹(브라우저 탭)에서만 AdSense 자동광고 로드 — 설치형 PWA/TWA·앱 빌드 제외.
maybeLoadWebAds()

// 실사용자 CWV 측정(F7) — 개발 중엔 콘솔로만 확인(백엔드 리포팅은 범위 밖, 후속 작업).
initWebVitals()
