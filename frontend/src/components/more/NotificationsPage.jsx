/**
 * NotificationsPage — 알림 설정 sub-page.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, Bell } from 'lucide-react'
import NotificationSettings from './NotificationSettings'

export default function NotificationsPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 bg-navy text-white px-4 py-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label="뒤로 가기"
        >
          <ChevronLeft size={20} />
        </button>
        <Bell size={18} />
        <h2 className="text-lg font-bold">알림 설정</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 md:pb-6">
        <NotificationSettings />
      </div>
    </div>
  )
}
