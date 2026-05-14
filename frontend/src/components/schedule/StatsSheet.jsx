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
        className="relative z-10 w-full md:max-w-md bg-white dark:bg-surface-dark rounded-t-[28px] md:rounded-[24px] shadow-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '88dvh' }}
      >
        <div className="flex items-start justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-display text-ink dark:text-white" style={{ letterSpacing: '-0.03em' }}>
              오늘의 교통
            </h2>
            <p className="mt-0.5 text-caption text-mute" style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
              지금 · 이후 흐름
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 pressable flex-shrink-0"
          >
            <X size={18} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <StatusChips />
          <div className="space-y-4">
            <TrafficFlowCard />
            <CrowdingCard />
            <WeatherCard />
          </div>
          <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
            교통 흐름 · 혼잡도는 과거 데이터 기반 예측입니다
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
