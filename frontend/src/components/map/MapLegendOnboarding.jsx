import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

const STORAGE_KEY = 'map-legend-seen'

export default function MapLegendOnboarding() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return
    const t = setTimeout(() => setVisible(true), 500)
    return () => clearTimeout(t)
  }, [])

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="absolute bottom-4 left-4 right-4 z-[45] rounded-2xl p-4 shadow-xl text-white"
      style={{ backgroundColor: '#102c4c' }}
      role="dialog"
      aria-label="지도 표시 안내"
    >
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="닫기"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p className="text-xs font-bold mb-2">지도 표시 안내</p>
      <ul className="text-xs space-y-1 opacity-90">
        <li>🔴 하교 · 제2등교 — 학교 출발 다음 버스까지 남은 시간</li>
        <li>🟢 G — 현재 정류장 근처 실시간 운행 중인 버스</li>
        <li>🟡 한국공대 ↔ 정왕역 — 도보 예상 시간</li>
      </ul>
    </div>
  )
}
