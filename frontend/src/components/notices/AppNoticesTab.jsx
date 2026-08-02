/**
 * AppNoticesTab — 공지 탭의 "앱 공지" 쪽.
 *
 * 예전 AppNoticesSettingsTab 에서 공지 부분만 떼어냈다. 그 컴포넌트는 앱 공지와
 * 설정 진입이 한 화면에 섞여 있어 "앱 공지" 라벨이 내용을 반만 설명했다 —
 * 설정은 더보기 탭에, 공지는 여기에 둔다.
 *
 * Props:
 *   onOpenNotices  () => void  — 공지 전체 목록(NoticesPage)으로 이동
 */
import { ChevronRight } from 'lucide-react'
import NoticeHighlights from '../more/NoticeHighlights'
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

export default function AppNoticesTab({ onOpenNotices }) {
  const { data: noticesData } = useNotices()
  const allNotices = Array.isArray(noticesData) ? noticesData : []
  const recent = allNotices.slice(0, 3)
  const hasMoreNotices = allNotices.length > recent.length

  return (
    <>
      <NoticeHighlights onOpen={onOpenNotices} />

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
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {n.title}
                </div>
                <div className="text-label font-semibold text-mute dark:text-mute" style={{ marginTop: 2 }}>
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
    </>
  )
}
