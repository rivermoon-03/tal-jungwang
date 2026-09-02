/**
 * NoticesPage — 공지사항 전체 목록.
 *
 * 안읽음 여부는 이 화면(전체 목록)을 연 시점에 "확인함"으로 기록한다 — 히어로
 * 카드(NoticeHighlights)와 미리보기 목록(AppNoticesTab)은 안읽음 도트만 보여줄
 * 뿐 읽음 처리는 하지 않는다. 실제로 전체 목록을 열어야 "읽었다"로 친다.
 */
import { useEffect } from 'react'
import { ChevronLeft, Megaphone } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'
import { formatFullDate as fmtDate } from '../../utils/noticeDate'
import { formatRelativeTime } from '../../utils/relativeTime'
import { isNoticeUnread, markNoticesSeen } from '../../utils/noticeReadState'
import IconButton from '../ui/IconButton'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../common/Skeleton'

const APP_NOTICE_CATEGORY = 'app'

function NoticesListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface dark:bg-surface rounded-card border border-line dark:border-line px-4 py-4 space-y-2">
          <Skeleton height="1rem" width="70%" />
          <Skeleton height="0.75rem" width="30%" />
          <Skeleton height="0.9rem" />
        </div>
      ))}
    </div>
  )
}

export default function NoticesPage({ onBack, embedded = false }) {
  const { data, loading, error, refetch } = useNotices()
  const notices = Array.isArray(data) ? data : []

  // 전체 목록을 연 시점의 항목들을 "확인함"으로 기록한다(계정이 없어 로컬 저장).
  useEffect(() => {
    if (!loading && !error && notices.length > 0) {
      markNoticesSeen(APP_NOTICE_CATEGORY, notices.map((n) => n.id))
    }
    // notices는 매 렌더 새 배열이라 data(원본 참조)로만 의존한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, error])

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      {!embedded && (
        <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-surface dark:bg-surface border-b border-line dark:border-line flex-shrink-0">
          <IconButton label="뒤로" onClick={onBack}>
            <ChevronLeft size={22} />
          </IconButton>
          <h1 className="text-panel-ttl text-ink dark:text-ink">공지사항</h1>
        </div>
      )}

      {/* 내용 — 로딩/에러/빈/정상 넷을 서로 다른 모양으로 구분한다. */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-4">
        {loading && <NoticesListSkeleton />}

        {!loading && error && (
          <ErrorState message="공지사항을 불러오지 못했어요" onRetry={refetch} className="py-8" />
        )}

        {!loading && !error && notices.length === 0 && (
          <EmptyState icon={<Megaphone size={28} aria-hidden="true" />} title="새 공지사항이 없어요" className="py-8" />
        )}

        {!loading && !error && notices.length > 0 && (
          <div className="flex flex-col gap-3">
            {notices.map((n) => {
              const unread = isNoticeUnread(APP_NOTICE_CATEGORY, n.id)
              return (
                <article
                  key={n.id}
                  className="bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-card px-4 py-4"
                >
                  <div className="flex items-start gap-2 mb-1.5">
                    <Megaphone size={16} className="text-accent dark:text-accent flex-shrink-0 mt-0.5" />
                    <h2 className="text-body font-bold text-ink dark:text-ink flex-1">
                      {n.title}
                    </h2>
                    {/* 안읽음 도트 — 읽은 항목도 자리는 그대로 비워 정렬이 흔들리지 않는다. */}
                    <span
                      aria-hidden="true"
                      className={`mt-2 h-[7px] w-[7px] flex-shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
                    />
                  </div>
                  <p className="text-label text-mute dark:text-mute mb-2 pl-6">
                    {fmtDate(n.created_at)} · {formatRelativeTime(n.created_at)}
                  </p>
                  <p className="text-label font-normal leading-relaxed text-ink dark:text-ink whitespace-pre-line pl-6">
                    {(n.content ?? '').replace(/\\n/g, '\n')}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
