/**
 * AppNoticesSettingsTab — 더보기 "설정 & 앱공지" 탭.
 *
 * 서비스 자체(앱) 공지 히어로 카드 + 최근 공지 프리뷰 + 설정/앱 정보 진입 +
 * 개인정보처리방침 링크. 예전 MorePage.jsx 본문에 있던 "빠른 설정"(알림·다크모드)
 * 그리드는 SettingsPage에 동일 기능(DarkModeSegment/노선 알림 토글)이 이미 있어
 * 완전한 중복 진입점이라 제거했다(2026-07).
 *
 * Props:
 *   onOpenNotices   () => void  — 공지 전체 목록(NoticesPage)으로 이동
 *   onOpenSettings  () => void  — 설정(SettingsPage)으로 이동
 *   onOpenAppInfo   () => void  — 앱 정보(AppInfoPage)로 이동
 *   onOpenPrivacy   () => void  — 개인정보처리방침(/privacy)으로 이동
 */
import { ChevronRight, Info, Settings as SettingsIcon } from 'lucide-react'
import NoticeHighlights from './NoticeHighlights'
import { useNotices } from '../../hooks/useMore'

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

export default function AppNoticesSettingsTab({ onOpenNotices, onOpenSettings, onOpenAppInfo, onOpenPrivacy }) {
  const { data: noticesData } = useNotices()
  const allNotices = Array.isArray(noticesData) ? noticesData : []
  const recent = allNotices.slice(0, 2)
  const hasMoreNotices = allNotices.length > recent.length

  return (
    <>
      {/* 공지 히어로 카드 */}
      <NoticeHighlights onOpen={onOpenNotices} />

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
                onClick={onOpenNotices}
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
              onClick={onOpenNotices}
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
          onClick={onOpenSettings}
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
          onClick={onOpenAppInfo}
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
        onClick={onOpenPrivacy}
        className="pressable w-full text-center text-label font-semibold text-mute dark:text-mute"
        style={{ marginTop: 12, padding: '8px', background: 'transparent', cursor: 'pointer' }}
      >
        개인정보처리방침
      </button>
    </>
  )
}
