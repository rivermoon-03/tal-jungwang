/**
 * MorePage — 더보기 탭.
 *
 * 공지(학사공지·앱 공지)가 공지 탭으로 나가면서 이 탭이 받는 질문은 하나로
 * 좁아졌다: "앱을 어떻게 쓰지". 그래서 세그먼트 탭 없이 진입 목록만 그린다 —
 * 예전에는 "앱 공지" 탭 안에 설정이 숨어 있어 라벨과 내용이 어긋났다.
 *
 * Sub-pages: settings, help, app-info. (/more/settings, /more/help, /more/app-info)
 */
import { useState } from 'react'
import { ChevronRight, Info, Settings as SettingsIcon, HelpCircle } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import AppInfoPage from './AppInfoPage'
import SettingsPage from './SettingsPage'
import HelpPage from './HelpPage'
import MorePCLayout from './MorePCLayout'
import { useIsDesktop } from '../../hooks/useMediaQuery'

const SUB_PAGE_TO_NAV = { settings: 'settings', 'app-info': 'app-info', help: 'help' }
const SUB_PAGE_PATHS = {
  'app-info': '/more/app-info',
  settings: '/more/settings',
  help: '/more/help',
}

const ENTRIES = [
  { id: 'settings', Icon: SettingsIcon, title: '설정', desc: '개인화 · 알림 · 데이터' },
  { id: 'help', Icon: HelpCircle, title: '도움말', desc: '홈 화면 위젯 · 자주 묻는 질문' },
  { id: 'app-info', Icon: Info, title: '앱 정보', desc: '버전 · 만든 사람' },
]

export default function MorePage() {
  const [subPage, setSubPage] = useState(() => {
    if (typeof window === 'undefined') return null
    const path = window.location.pathname
    return Object.keys(SUB_PAGE_PATHS).find((id) => SUB_PAGE_PATHS[id] === path) ?? null
  })
  const isDesktop = useIsDesktop()

  const closeSubPage = () => {
    if (typeof window !== 'undefined' && Object.values(SUB_PAGE_PATHS).includes(window.location.pathname)) {
      window.history.pushState(null, '', '/more')
    }
    setSubPage(null)
  }
  const openSubPage = (id) => {
    if (typeof window !== 'undefined' && SUB_PAGE_PATHS[id]) {
      window.history.pushState(null, '', SUB_PAGE_PATHS[id])
    }
    setSubPage(id)
  }

  // PC(≥768px)에서는 사이드바가 네비를 담당하므로 rail 레이아웃을 쓴다.
  if (isDesktop) return <MorePCLayout initialNav={SUB_PAGE_TO_NAV[subPage] ?? 'settings'} />

  if (subPage === 'app-info') return <AppInfoPage onBack={closeSubPage} />
  if (subPage === 'help') return <HelpPage onBack={closeSubPage} />
  if (subPage === 'settings') {
    return <SettingsPage onBack={closeSubPage} onOpenAppInfo={() => openSubPage('app-info')} />
  }

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-fade-in-up">
      <PageHeader title="더보기" />

      <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-6">
        <div className="bg-white dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
          {ENTRIES.map(({ id, Icon, title, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => openSubPage(id)}
              className="pressable w-full flex items-center justify-between px-[14px] py-3"
              aria-label={`${title} 열기`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-mini bg-surface-2 dark:bg-bg flex items-center justify-center text-accent"
                  aria-hidden="true"
                >
                  <Icon size={18} />
                </div>
                <div className="text-left">
                  <div className="text-body font-semibold text-ink dark:text-ink">{title}</div>
                  <div className="text-label font-semibold text-mute dark:text-mute mt-0.5">{desc}</div>
                </div>
              </div>
              <ChevronRight size={18} aria-hidden="true" className="text-mute dark:text-mute" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            window.history.pushState({}, '', '/privacy')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          className="pressable w-full text-center text-label font-semibold text-mute dark:text-mute"
          style={{ marginTop: 12, padding: '8px', background: 'transparent', cursor: 'pointer' }}
        >
          개인정보처리방침
        </button>
      </div>
    </div>
  )
}
