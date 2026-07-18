/**
 * MorePage — 더보기 탭 (디자인 번들 MoreB · 출발지/도보속도 카드 제외).
 *   - 공지 히어로 카드 (NoticeHighlights)
 *   - 빠른 설정 그리드 (알림 / 다크모드)
 *   - 최근 공지 카드 리스트
 *   - Made by 소공 푸터
 *
 * Sub-pages: dark-mode, notifications, notices, info
 */
import { useState } from 'react'
import { Bell, Moon, Info, ChevronRight, Settings as SettingsIcon } from 'lucide-react'
import NoticeHighlights from './NoticeHighlights'
import PageHeader from '../layout/PageHeader'
import DarkModePage from './DarkModePage'
import NotificationsPage from './NotificationsPage'
import NoticesPage from './NoticesPage'
import AppInfoPage from './AppInfoPage'
import SettingsPage from './SettingsPage'
import { useNotices } from '../../hooks/useMore'
import useAppStore from '../../stores/useAppStore'

function fmtDateShort(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMin = Math.floor((now - d) / 60000)
  if (diffMin < 60) return `${Math.max(1, diffMin)}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function QuickCard({ icon, label, sub, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable text-left"
      style={{
        background: 'transparent',
        border: '1px solid var(--tj-line)',
        borderRadius: 12,
        padding: '12px 14px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        fontFamily: 'inherit',
        transition:
          'background var(--dur-motion-base) var(--e-out), border-color var(--dur-motion-base) var(--e-out)',
      }}
    >
      <div style={{ color: 'var(--tj-ink)' }} className="dark:text-ink">{icon}</div>
      <div className="text-body font-semibold text-ink dark:text-ink">
        {label}
      </div>
      <div className="text-label font-semibold text-mute dark:text-mute">{sub}</div>
    </button>
  )
}

const SUB_PAGE_PATHS = { 'app-info': '/more/app-info', settings: '/more/settings' }

export default function MorePage() {
  const [subPage, setSubPage] = useState(() => {
    if (typeof window === 'undefined') return null
    const path = window.location.pathname
    return Object.keys(SUB_PAGE_PATHS).find((id) => SUB_PAGE_PATHS[id] === path) ?? null
  })

  const { data: noticesData } = useNotices()
  const themeMode = useAppStore((s) => s.themeMode)
  const notifPrefs = useAppStore((s) => s.notifPrefs)

  const themeLabel = { light: '라이트', system: '자동', dark: '다크' }[themeMode] ?? '자동'
  const leadMin = notifPrefs?.leadMin ?? 10
  const alarmSub = notifPrefs?.enabled === false ? '꺼짐' : `${leadMin}분 전`

  // app-info/settings처럼 안정 URL(/more/*)이 있는 서브페이지만 히스토리에 반영한다.
  // dark-mode/notifications/notices는 기존과 동일하게 상태 전용(뒤로가기 시 더보기 루트로).
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

  if (subPage === 'dark-mode')     return <DarkModePage        onBack={() => setSubPage(null)} />
  if (subPage === 'notifications') return <NotificationsPage   onBack={() => setSubPage(null)} />
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

  const allNotices = Array.isArray(noticesData) ? noticesData : []
  const recent = allNotices.slice(0, 2)
  const hasMoreNotices = allNotices.length > recent.length

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-fade-in-up">
      <PageHeader title="더보기" />

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-28 md:pb-6">
        {/* 공지 히어로 카드 */}
        <NoticeHighlights onOpen={() => setSubPage('notices')} />

        {/* 빠른 설정 */}
        <div
          className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest"
          style={{ margin: '6px 0 8px', letterSpacing: '0.14em' }}
        >
          빠른 설정
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
            marginBottom: 14,
          }}
        >
          <QuickCard
            icon={<Bell size={16} />}
            label="알림"
            sub={alarmSub}
            onClick={() => setSubPage('notifications')}
          />
          <QuickCard
            icon={<Moon size={16} />}
            label="다크모드"
            sub={themeLabel}
            onClick={() => setSubPage('dark-mode')}
          />
        </div>

        {/* 최근 공지 */}
        {recent.length > 0 && (
          <>
            <div
              className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest"
              style={{ marginBottom: 8, letterSpacing: '0.14em' }}
            >
              최근 공지
            </div>
            <div
              style={{
                background: 'transparent',
                borderRadius: 14,
                border: '1px solid var(--tj-line)',
                overflow: 'hidden',
                marginBottom: 14,
              }}
              className="bg-white dark:bg-surface"
            >
              {recent.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => setSubPage('notices')}
                  className="pressable w-full text-left"
                  style={{
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--tj-line-soft)',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'block',
                  }}
                >
                  <div
                    className="text-body font-semibold text-ink dark:text-ink"
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {n.title}
                  </div>
                  <div
                    className="text-label font-semibold text-mute dark:text-mute"
                    style={{ marginTop: 2 }}
                  >
                    {fmtDateShort(n.created_at)}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSubPage('notices')}
                className="pressable w-full flex items-center justify-center gap-1 text-label font-semibold text-mute dark:text-mute"
                style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--tj-line-soft)',
                  background: 'transparent',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
                aria-label="전체 공지 보기"
              >
                {hasMoreNotices ? '더보기' : '전체 공지 보기'}
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          </>
        )}

        {/* 설정 · 앱 정보 진입 — DESIGN.md 시안 "더보기 · A"의 sc-set 그룹 대응 */}
        <div className="bg-white dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
          <button
            type="button"
            onClick={openSettings}
            className="pressable w-full flex items-center justify-between px-[14px] py-3"
            aria-label="설정 열기"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-mini bg-surface-2 dark:bg-bg flex items-center justify-center text-accent" aria-hidden="true">
                <SettingsIcon size={18} />
              </div>
              <div className="text-left">
                <div className="text-body font-semibold text-ink dark:text-ink">설정</div>
                <div className="text-label font-semibold text-mute dark:text-mute mt-0.5">개인화 · 알림 · 데이터</div>
              </div>
            </div>
            <ChevronRight size={18} aria-hidden="true" className="text-mute dark:text-mute" />
          </button>
          <button
            type="button"
            onClick={openAppInfo}
            className="pressable w-full flex items-center justify-between px-[14px] py-3"
            aria-label="앱 정보 보기"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-mini bg-surface-2 dark:bg-bg flex items-center justify-center text-accent" aria-hidden="true">
                <Info size={18} />
              </div>
              <div className="text-body font-semibold text-ink dark:text-ink">앱 정보</div>
            </div>
            <ChevronRight size={18} aria-hidden="true" className="text-mute dark:text-mute" />
          </button>
        </div>

        {/* 개인정보처리방침 (마켓 등록용 안정 URL /privacy) */}
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
