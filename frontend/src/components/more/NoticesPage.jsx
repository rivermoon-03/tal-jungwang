/**
 * NoticesPage — 공지사항 목록
 */
import { ChevronLeft, Megaphone } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function NoticesPage({ onBack }) {
  const { data, loading, error } = useNotices()
  const notices = Array.isArray(data) ? data : []

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-surface dark:bg-surface border-b border-line dark:border-line flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line transition-colors"
        >
          <ChevronLeft size={22} className="text-ink dark:text-ink" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink">공지사항</h1>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-4">
        {loading && (
          <p className="text-body text-mute dark:text-mute text-center py-8">불러오는 중이에요...</p>
        )}
        {error && (
          <p className="text-body text-red-400 text-center py-8">
            공지사항을 불러오지 못했어요
          </p>
        )}
        {!loading && !error && notices.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-mute dark:text-mute">
            <Megaphone size={28} />
            <p className="text-body">새 공지사항이 없어요</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {notices.map((n) => (
            <article
              key={n.id}
              className="bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-card px-4 py-4"
            >
              <div className="flex items-start gap-2 mb-1.5">
                <Megaphone size={16} className="text-accent dark:text-accent flex-shrink-0 mt-0.5" />
                <h2 className="text-body font-bold text-ink dark:text-ink">
                  {n.title}
                </h2>
              </div>
              <p className="text-label text-mute dark:text-mute mb-2 pl-6">{fmtDate(n.created_at)}</p>
              <p className="text-[15px] leading-relaxed text-ink dark:text-ink whitespace-pre-line pl-6">
                {(n.content ?? '').replace(/\\n/g, '\n')}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
