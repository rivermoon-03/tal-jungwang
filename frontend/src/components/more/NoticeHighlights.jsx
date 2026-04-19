/**
 * NoticeHighlights — 더보기 탭 상단의 최근 공지 카드 하이라이트.
 *
 * Props:
 *   count: number             최근 몇 개까지 렌더할지 (default 2)
 *   onOpen?: (notice) => void 카드 클릭 시 호출. 미지정 시 내부 기본 동작(/more 공지 서브 페이지 이동 트리거 없음 → 호출자 위임)
 *
 * 동작:
 *   - useNotices()로 공지 fetch
 *   - 최신 N개만 카드로 렌더 (rounded-xl, px-4 py-3, 제목 + 날짜 + 본문 1줄 미리보기)
 *   - 데이터 없음/로딩/에러이면 null
 */
import { Megaphone } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function previewLine(content) {
  if (!content) return ''
  const normalized = content.replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim()
  return normalized.length > 60 ? `${normalized.slice(0, 60)}…` : normalized
}

export default function NoticeHighlights({ count = 2, onOpen }) {
  const { data, loading, error } = useNotices()
  if (loading || error) return null
  const notices = Array.isArray(data) ? data : []
  if (notices.length === 0) return null

  const top = notices.slice(0, count)

  return (
    <section aria-label="최근 공지" className="flex flex-col gap-2 mb-3">
      {top.map((n) => {
        const preview = previewLine(n.content)
        return (
          <button
            key={n.id}
            type="button"
            onClick={onOpen ? () => onOpen(n) : undefined}
            className="w-full text-left rounded-xl px-4 py-3 bg-white dark:bg-surface-dark border border-slate-100 dark:border-border-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.99] transition pressable"
          >
            <div className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5 text-slate-500 dark:text-slate-400">
                <Megaphone size={16} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {n.title}
                  </p>
                  <span className="text-[11px] text-slate-400 flex-shrink-0">
                    {fmtDate(n.created_at)}
                  </span>
                </div>
                {preview && (
                  <p className="mt-0.5 text-[13px] text-slate-500 dark:text-slate-400 truncate">
                    {preview}
                  </p>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )
}
