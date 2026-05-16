/**
 * NotificationsPage — 알림 설정 sub-page.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, Construction } from 'lucide-react'

export default function NotificationsPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg-dark animate-slide-in-right">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line-dark transition-colors"
        >
          <ChevronLeft size={22} className="text-ink dark:text-ink-dark" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink-dark">알림 설정</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-28 md:pb-6 flex items-center justify-center">
        <div className="bg-surface dark:bg-surface-dark rounded-card shadow-card px-7 py-8 max-w-xs w-full flex flex-col items-center gap-3.5 text-center">
          <div className="w-14 h-14 rounded-card bg-chip-yellow-bg dark:bg-chip-yellow-bg-dark flex items-center justify-center text-chip-yellow-fg dark:text-chip-yellow-fg-dark">
            <Construction size={26} strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-panel-ttl text-ink dark:text-ink-dark">개발 중</p>
            <p className="text-meta font-semibold text-mute dark:text-mute-dark mt-1.5 leading-relaxed">
              버스·셔틀·지하철 출발 알림 기능을 준비하고 있어요.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
