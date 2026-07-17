import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import StatusChips from '../stats/StatusChips'
import TrafficFlowCard from '../stats/TrafficFlowCard'
import CrowdingCard from '../stats/CrowdingCard'
import WeatherCard from '../stats/WeatherCard'

export default function StatsSheet({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label="오늘의 교통 통계"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full md:max-w-md bg-surface dark:bg-surface rounded-t-card-lg md:rounded-card-lg shadow-card-md flex flex-col animate-slide-up"
        style={{ maxHeight: '88dvh' }}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="flex justify-center pt-3.5 pb-1 flex-shrink-0 md:hidden">
          <div className="w-11 h-1 rounded-full bg-line-strong dark:bg-line-strong" />
        </div>
        <div className="flex items-start justify-between px-5 pt-2 md:pt-4 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-page-ttl text-ink dark:text-ink">
              오늘의 교통
            </h2>
            <p className="mt-1 text-meta font-semibold text-mute dark:text-mute tracking-tight">
              지금 · 이후 흐름
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-line dark:bg-line hover:bg-line-strong/40 dark:hover:bg-line-strong/40 pressable flex-shrink-0 transition-colors"
          >
            <X size={18} className="text-ink-2 dark:text-ink-2" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <StatusChips />
          <div className="space-y-4">
            <TrafficFlowCard />
            <CrowdingCard />
            <WeatherCard />
          </div>
          <p className="mt-5 text-center text-meta font-semibold text-mute dark:text-mute">
            교통 흐름 · 혼잡도는 과거 데이터 기반 예측입니다
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
