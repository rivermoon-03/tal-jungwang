/**
 * AppNoticesTab — 공지 탭의 "앱 공지" 쪽.
 *
 * 예전 AppNoticesSettingsTab 에서 공지 부분만 떼어냈다. 그 컴포넌트는 앱 공지와
 * 설정 진입이 한 화면에 섞여 있어 "앱 공지" 라벨이 내용을 반만 설명했다 —
 * 설정은 더보기 탭에, 공지는 여기에 둔다.
 *
 * 로딩/에러/빈 목록을 예전엔 구분하지 않았다 — `noticesData`만 보고 없으면
 * (로딩 중이든 진짜 0건이든 네트워크 에러든) 그냥 아무것도 안 그렸다. 넷을
 * 구분한다: 로딩은 스켈레톤, 에러는 다시 시도 버튼, 빈 목록은 안내 문구,
 * 정상이면 목록 아래에 "N분 전 정보 + 새로고침" 신선도 행을 둔다.
 *
 * Props:
 *   onOpenNotices  () => void  — 공지 전체 목록(NoticesPage)으로 이동
 */
import { ChevronRight, RefreshCw } from 'lucide-react'
import NoticeHighlights from '../more/NoticeHighlights'
import { useNotices } from '../../hooks/useMore'
import { formatRelativeTime } from '../../utils/relativeTime'
import { isNoticeUnread } from '../../utils/noticeReadState'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../common/Skeleton'

const APP_NOTICE_CATEGORY = 'app'

function RecentListSkeleton() {
  return (
    <div
      className="mb-3.5 overflow-hidden rounded-card border border-line bg-white dark:bg-surface dark:border-line"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className={`p-3.5 ${i > 0 ? 'border-t border-line-soft dark:border-line' : ''}`}>
          <Skeleton height="1rem" width="70%" />
          <div className="mt-2">
            <Skeleton height="0.75rem" width="30%" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AppNoticesTab({ onOpenNotices }) {
  const { data: noticesData, loading, error, fetchedAt, refetch } = useNotices()
  const allNotices = Array.isArray(noticesData) ? noticesData : []
  const recent = allNotices.slice(0, 3)
  const hasMoreNotices = allNotices.length > recent.length

  return (
    <>
      <NoticeHighlights onOpen={onOpenNotices} />

      {loading && <RecentListSkeleton />}

      {!loading && error && (
        <ErrorState message="공지사항을 불러오지 못했어요" onRetry={refetch} className="py-8" />
      )}

      {!loading && !error && allNotices.length === 0 && (
        <EmptyState title="아직 공지가 없어요" className="py-8" />
      )}

      {!loading && !error && recent.length > 0 && (
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
              marginBottom: 6,
            }}
            className="bg-white dark:bg-surface"
          >
            {recent.map((n, i) => {
              const unread = isNoticeUnread(APP_NOTICE_CATEGORY, n.id)
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={onOpenNotices}
                  aria-label={`${unread ? '안읽음 · ' : ''}${n.title}`}
                  className="pressable w-full text-left flex items-start gap-2"
                  style={{
                    padding: '12px 14px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--tj-line-soft)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {/* 안읽음 도트 — 읽은 항목도 자리는 그대로 비워 정렬이 흔들리지 않는다. */}
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-[7px] w-[7px] flex-shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-body font-semibold text-ink dark:text-ink"
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {n.title}
                    </div>
                    <div className="text-label font-semibold text-mute dark:text-mute" style={{ marginTop: 2 }}>
                      {formatRelativeTime(n.created_at)}
                    </div>
                  </div>
                </button>
              )
            })}
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

          {/* 신선도 행 — "언제 기준 목록인지 + 새로고침" 한 줄. 로딩/빈 상태와
              시각적으로 겹치지 않도록 정상 목록일 때만 보인다. */}
          {fetchedAt && (
            <div className="mb-3.5 flex items-center justify-between px-1">
              <span className="text-label text-mute dark:text-mute">
                {formatRelativeTime(new Date(fetchedAt))} 정보
              </span>
              <button
                type="button"
                onClick={refetch}
                className="pressable flex items-center gap-1 px-2 py-1 -mr-2 min-h-[44px] text-label font-semibold text-mute dark:text-mute"
                aria-label="공지 새로고침"
              >
                <RefreshCw size={12} aria-hidden="true" />
                새로고침
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
