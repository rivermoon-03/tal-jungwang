/**
 * NotificationsPage — 알림 설정 sub-page.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, Construction } from 'lucide-react'

export default function NotificationsPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      {/* header — NoticesPage와 통일된 스타일 */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">알림 설정</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 md:pb-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Construction size={40} strokeWidth={1.5} />
          <p className="text-sm font-bold">개발 중입니다</p>
          <p className="text-xs text-center text-slate-400 max-w-[240px] leading-relaxed">
            버스·셔틀·지하철 출발 알림 기능을 준비하고 있어요.
          </p>
        </div>
      </div>
    </div>
  )
}
