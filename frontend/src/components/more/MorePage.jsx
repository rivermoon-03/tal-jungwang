/**
 * MorePage — 더보기 탭.
 *   - 세그먼트 탭 2개: [학사공지] [설정 & 앱공지] (AcademicNoticesTab / AppNoticesSettingsTab)
 *   - Made by 소공 푸터는 앱공지 탭 쪽 서브트리에 남아 있음
 *
 * Sub-pages: notices, info, settings.
 * (dark-mode/notifications 진입점은 제거됨 — SettingsPage 안에 DarkModeSegment/노선 알림
 *  토글로 이미 있어 중복이었다. DarkModePage.jsx/NotificationsPage.jsx 자체는 그대로 둔다.)
 */
import { useState } from 'react'
import PageHeader from '../layout/PageHeader'
import SegmentTabs from '../ui/SegmentTabs.jsx'
import NoticesPage from './NoticesPage'
import AppInfoPage from './AppInfoPage'
import SettingsPage from './SettingsPage'
import AcademicNoticesTab from './AcademicNoticesTab'
import AppNoticesSettingsTab from './AppNoticesSettingsTab'
import MorePCLayout from './MorePCLayout'
import { useIsDesktop } from '../../hooks/useMediaQuery'

// subPage 상태(모바일 서브페이지 id) → MorePCLayout의 rail nav id 매핑.
// null(더보기 루트)은 PC에서 기본 진입 탭인 학사공지로 매핑한다.
const SUB_PAGE_TO_NAV = { settings: 'settings', 'app-info': 'app-info', notices: 'notices' }

const SUB_PAGE_PATHS = { 'app-info': '/more/app-info', settings: '/more/settings' }

const TOP_TABS = [
  { id: 'academic', label: '학사공지' },
  { id: 'settings', label: '설정 & 앱공지' },
]

export default function MorePage() {
  const [subPage, setSubPage] = useState(() => {
    if (typeof window === 'undefined') return null
    const path = window.location.pathname
    return Object.keys(SUB_PAGE_PATHS).find((id) => SUB_PAGE_PATHS[id] === path) ?? null
  })
  const [topTab, setTopTab] = useState('academic')
  const isDesktop = useIsDesktop()

  // app-info/settings처럼 안정 URL(/more/*)이 있는 서브페이지만 히스토리에 반영한다.
  // notices는 기존과 동일하게 상태 전용(뒤로가기 시 더보기 루트로).
  const closeSubPage = () => {
    if (typeof window !== 'undefined' && Object.values(SUB_PAGE_PATHS).includes(window.location.pathname)) {
      window.history.pushState(null, '', '/more')
    }
    setSubPage(null)
  }
  const openSubPageWithPath = (id) => {
    if (typeof window !== 'undefined' && SUB_PAGE_PATHS[id]) {
      window.history.pushState(null, '', SUB_PAGE_PATHS[id])
    }
    setSubPage(id)
  }
  const openAppInfo = () => openSubPageWithPath('app-info')
  const openSettings = () => openSubPageWithPath('settings')

  // PC(≥768px)에서는 세그먼트 탭 기반 모바일 흐름 대신 rail 레이아웃을 쓴다.
  // /more/settings 같은 딥링크로 진입해도 subPage가 이미 매핑되어 있으므로
  // rail이 해당 항목을 연 상태로 시작한다.
  if (isDesktop) return <MorePCLayout initialNav={SUB_PAGE_TO_NAV[subPage] ?? 'academic'} />

  if (subPage === 'notices')       return <NoticesPage         onBack={() => setSubPage(null)} />
  if (subPage === 'app-info')      return <AppInfoPage         onBack={closeSubPage} />
  if (subPage === 'settings') {
    return (
      <SettingsPage
        onBack={closeSubPage}
        onOpenAppInfo={openAppInfo}
      />
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-fade-in-up">
      <PageHeader title="더보기" />

      <div className="px-4 pt-1 pb-2 flex-shrink-0">
        <SegmentTabs items={TOP_TABS} active={topTab} onChange={setTopTab} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-6">
        {topTab === 'academic' ? (
          <AcademicNoticesTab />
        ) : (
          <AppNoticesSettingsTab
            onOpenNotices={() => setSubPage('notices')}
            onOpenSettings={openSettings}
            onOpenAppInfo={openAppInfo}
            onOpenPrivacy={() => {
              window.history.pushState({}, '', '/privacy')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          />
        )}
      </div>
    </div>
  )
}
