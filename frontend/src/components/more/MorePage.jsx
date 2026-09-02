/**
 * MorePage — 더보기 탭.
 *
 * 공지(학사공지·앱 공지)가 공지 탭으로 나가면서 이 탭이 받는 질문은 하나로
 * 좁아졌다: "앱을 어떻게 쓰지". 그래서 세그먼트 탭 없이 진입 목록만 그린다 —
 * 예전에는 "앱 공지" 탭 안에 설정이 숨어 있어 라벨과 내용이 어긋났다.
 *
 * 항목이 설정/정보/정책 세 그룹으로 흩어져 있는데도 예전엔 구분 없이 한 줄로
 * 쭉 나열됐다(개인정보처리방침은 그마저도 목록 밖 텍스트 링크로 따로 떨어져
 * 있었다) — SettingsPage.jsx의 SectionLabel/그룹 패턴을 그대로 가져와 셋으로
 * 나누고, 개인정보처리방침도 같은 행 스타일(아이콘 + 설명 + 44px 이상 높이)로
 * 목록 안에 넣는다.
 *
 * Sub-pages: settings, help, app-info. (/more/settings, /more/help, /more/app-info)
 */
import { useState } from 'react'
import { ChevronRight, Info, Settings as SettingsIcon, HelpCircle, ShieldCheck } from 'lucide-react'
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

// id: 'privacy'는 서브페이지가 아니라 /privacy 라우트로 바로 이동한다(아래 openEntry).
const GROUPS = [
  {
    label: '설정',
    entries: [
      { id: 'settings', Icon: SettingsIcon, title: '설정', desc: '개인화 · 알림 · 데이터' },
    ],
  },
  {
    label: '정보',
    entries: [
      { id: 'help', Icon: HelpCircle, title: '도움말', desc: '홈 화면 위젯 · 자주 묻는 질문' },
      { id: 'app-info', Icon: Info, title: '앱 정보', desc: '버전 · 만든 사람' },
    ],
  },
  {
    label: '정책',
    entries: [
      { id: 'privacy', Icon: ShieldCheck, title: '개인정보처리방침', desc: '수집 항목 · 보관 기간 · 제3자 제공' },
    ],
  },
]

function SectionLabel({ children }) {
  return (
    <div className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest px-1 mb-2">
      {children}
    </div>
  )
}

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
  // 개인정보처리방침은 이 컴포넌트의 서브페이지가 아니라 /privacy 라우트(안정
  // URL, 마켓 등록용)로 이동한다 — 나머지 항목은 openSubPage로 처리.
  const openEntry = (id) => {
    if (id === 'privacy') {
      if (typeof window !== 'undefined') {
        window.history.pushState({}, '', '/privacy')
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
      return
    }
    openSubPage(id)
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

      <div className="flex-1 overflow-y-auto px-4 pb-28 md:pb-6 flex flex-col gap-5">
        {GROUPS.map(({ label, entries }) => (
          <div key={label}>
            <SectionLabel>{label}</SectionLabel>
            <div className="bg-white dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
              {/* min-h-11(44px)로 터치 타깃 하한을 명시한다 — 아이콘+두 줄 텍스트로
                  이미 넘지만, 설명이 없는 행(정책 등)도 항상 이 이상을 보장한다. */}
              {entries.map(({ id, Icon, title, desc }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openEntry(id)}
                  className="pressable w-full min-h-11 flex items-center justify-between gap-3 px-[14px] py-3"
                  aria-label={`${title} 열기`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 shrink-0 rounded-mini bg-surface-2 dark:bg-bg flex items-center justify-center text-accent"
                      aria-hidden="true"
                    >
                      <Icon size={18} />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-body font-semibold text-ink dark:text-ink">{title}</div>
                      {desc && (
                        <div className="text-label font-semibold text-mute dark:text-mute mt-0.5 truncate">{desc}</div>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" className="text-mute dark:text-mute shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
