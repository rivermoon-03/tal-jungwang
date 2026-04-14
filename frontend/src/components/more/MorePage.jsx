/**
 * MorePage — 더보기 탭 (미니멀 5개 행)
 * Sub-pages (dark-mode, notifications) handled via local subPage state.
 */
import { useState } from 'react'
import { Megaphone, Moon, Bell, Info } from 'lucide-react'
import MoreRow from './MoreRow'
import DarkModePage from './DarkModePage'
import NotificationsPage from './NotificationsPage'
import NoticesPage from './NoticesPage'
import { useNotices, useAppInfo } from '../../hooks/useMore'
import useAppStore from '../../stores/useAppStore'

// App version from meta or static fallback
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

export default function MorePage() {
  const [subPage, setSubPage] = useState(null) // null | 'dark-mode' | 'notifications' | 'notices'

  const { data: noticesData } = useNotices()
  const { data: infoData } = useAppInfo()
  const themeMode = useAppStore((s) => s.themeMode)

  const unreadNotices = Array.isArray(noticesData) ? noticesData.length : 0

  const themeLabel = { light: '라이트', system: '시스템', dark: '다크' }[themeMode] ?? '시스템'

  // sub-page routing
  if (subPage === 'dark-mode') return <DarkModePage onBack={() => setSubPage(null)} />
  if (subPage === 'notifications') return <NotificationsPage onBack={() => setSubPage(null)} />
  if (subPage === 'notices') return <NoticesPage onBack={() => setSubPage(null)} />

  const version = infoData?.version ?? APP_VERSION

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-28 md:pb-6">
        {/* card wrapper */}
        <div className="rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden">
          {/* 1. 공지사항 */}
          <MoreRow
            icon={<Megaphone size={18} />}
            label="공지사항"
            badge={unreadNotices}
            chevron
            onClick={() => setSubPage('notices')}
            first
          />

          {/* 2. 다크모드 */}
          <MoreRow
            icon={<Moon size={18} />}
            label="다크모드"
            value={themeLabel}
            chevron
            onClick={() => setSubPage('dark-mode')}
          />

          {/* 4. 알림 설정 */}
          <MoreRow
            icon={<Bell size={18} />}
            label="알림 설정"
            chevron
            onClick={() => setSubPage('notifications')}
          />

          {/* 5. 앱 정보 */}
          <MoreRow
            icon={<Info size={18} />}
            label="앱 정보"
            value={`v${version}`}
            onClick={() => {/* TODO: 앱 정보 모달 */}}
            last
          />
        </div>
      </div>
    </div>
  )
}
