import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// React 마운트 전에 동기적으로 dark 클래스 설정 — useEffect 지연으로 인한 플래시 방지
if (localStorage.getItem('tal_dark') === '1') {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* 등록 실패는 무시 */})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
