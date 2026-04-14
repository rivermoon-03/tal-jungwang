/**
 * MorePage — 더보기 탭 (미니멀 5개 행)
 * Sub-pages (dark-mode, notifications) handled via local subPage state.
 */
import { useState } from 'react'
import { Megaphone, Link2, Moon, Bell, Info, MoreHorizontal } from 'lucide-react'
import MoreRow from './MoreRow'
import DarkModePage from './DarkModePage'
import NotificationsPage from './NotificationsPage'
import { useNotices, useAppInfo } from '../../hooks/useMore'
import useAppStore from '../../stores/useAppStore'

// App version from meta or static fallback
const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

export default function MorePage() {
  const [subPage, setSubPage] = useState(null) // null | 'dark-mode' | 'notifications'

  const { data: noticesData } = useNotices()
  const { data: infoData } = useAppInfo()
  const themeMode = useAppStore((s) => s.themeMode)

  const unreadNotices = Array.isArray(noticesData) ? noticesData.length : 0

  const themeLabel = { light: '라이트', system: '시스템', dark: '다크' }[themeMode] ?? '시스템'

  // sub-page routing
  if (subPage === 'dark-mode') return <DarkModePage onBack={() => setSubPage(null)} />
  if (subPage === 'notifications') return <NotificationsPage onBack={() => setSubPage(null)} />

  const version = infoData?.version ?? APP_VERSION

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 bg-navy text-white px-5 py-4 flex-shrink-0">
        <MoreHorizontal size={20} strokeWidth={2} />
        <h2 className="text-lg font-bold">더보기</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-28 md:pb-6">
        {/* card wrapper */}
        <div className="rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden">
          {/* 1. 공지사항 */}
          <MoreRow
            icon={<Megaphone size={18} />}
            label="공지사항"
            badge={unreadNotices}
            chevron
            onClick={() => {/* TODO: 공지사항 페이지 or 모달 */}}
            first
          />

          {/* 2. 유용한 링크 */}
          <MoreRow
            icon={<Link2 size={18} />}
            label="유용한 링크"
            chevron
            onClick={() => {/* TODO: 링크 목록 페이지 */}}
          />

          {/* 3. 다크모드 */}
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
