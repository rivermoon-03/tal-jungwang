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
import { Bell, Moon, Heart } from 'lucide-react'
import NoticeHighlights from './NoticeHighlights'
import PageHeader from '../layout/PageHeader'
import DarkModePage from './DarkModePage'
import NotificationsPage from './NotificationsPage'
import NoticesPage from './NoticesPage'
import { useNotices, useAppInfo } from '../../hooks/useMore'
import useAppStore from '../../stores/useAppStore'

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '1.0.0'

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
          'background var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
      }}
    >
      <div style={{ color: 'var(--tj-ink)' }} className="dark:text-slate-100">{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tj-ink)' }} className="dark:text-slate-100">
        {label}
      </div>
      <div style={{ fontSize: 10, color: 'var(--tj-mute)', fontWeight: 600 }}>{sub}</div>
    </button>
  )
}

export default function MorePage() {
  const [subPage, setSubPage] = useState(null)

  const { data: noticesData } = useNotices()
  const { data: infoData } = useAppInfo()
  const themeMode = useAppStore((s) => s.themeMode)
  const notifPrefs = useAppStore((s) => s.notifPrefs)

  const themeLabel = { light: '라이트', system: '자동', dark: '다크' }[themeMode] ?? '자동'
  const leadMin = notifPrefs?.leadMin ?? 10
  const alarmSub = notifPrefs?.enabled === false ? '꺼짐' : `${leadMin}분 전`

  if (subPage === 'dark-mode')     return <DarkModePage        onBack={() => setSubPage(null)} />
  if (subPage === 'notifications') return <NotificationsPage   onBack={() => setSubPage(null)} />
  if (subPage === 'notices')       return <NoticesPage         onBack={() => setSubPage(null)} />

  const version = infoData?.version ?? APP_VERSION
  const allNotices = Array.isArray(noticesData) ? noticesData : []
  const recent = allNotices.slice(0, 2)
  const hasMoreNotices = allNotices.length > recent.length

  return (
    <div className="flex flex-col h-full bg-bg-soft-light dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="더보기" />

      <div className="flex-1 overflow-y-auto px-4 pt-1 pb-28 md:pb-6">
        {/* 공지 히어로 카드 */}
        <NoticeHighlights onOpen={() => setSubPage('notices')} />

        {/* 빠른 설정 */}
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.14em',
            color: 'var(--tj-mute)',
            textTransform: 'uppercase',
            margin: '6px 0 8px',
          }}
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
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.14em',
                color: 'var(--tj-mute)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
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
              className="bg-white dark:bg-surface-dark"
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
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--tj-ink)',
                    }}
                    className="dark:text-slate-100"
                  >
                    {n.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--tj-mute)',
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {fmtDateShort(n.created_at)}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSubPage('notices')}
                className="pressable w-full"
                style={{
                  padding: '10px 14px',
                  borderTop: '1px solid var(--tj-line-soft)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 800,
                  color: 'var(--tj-mute)',
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                }}
                aria-label="전체 공지 보기"
              >
                {hasMoreNotices ? '더보기' : '전체 공지 보기'} →
              </button>
            </div>
          </>
        )}

        {/* Made by 소공 */}
        <div
          style={{
            background: 'transparent',
            borderRadius: 14,
            border: '1px solid var(--tj-line)',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
          className="bg-white dark:bg-surface-dark"
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: 'var(--tj-bg-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tj-accent)',
            }}
          >
            <Heart size={18} fill="currentColor" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--tj-ink)' }} className="dark:text-slate-100">
              Made by moonlandingplan
            </div>
            <div style={{ fontSize: 10, color: 'var(--tj-mute)', fontWeight: 500, marginTop: 2 }}>
              한국공대 · v{version}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
