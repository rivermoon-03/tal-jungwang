/**
 * AcademicNoticesPCContent — 더보기 PC 레이아웃 우측 "학사공지" 콘텐츠.
 *
 * AcademicNoticesTab(모바일판)과 데이터 로직을 공유한다(훅/유틸 재사용, 로직 복제
 * 금지). 레이아웃만 PC 전용으로 재구성한다.
 *
 * DS1(2026-08): 학과 select를 제거하고 전교 게시판 카테고리 칩으로 대체.
 *   1. 상단 한 줄 헤더 — 카테고리 칩 행.
 *   2. 본문 — 캘린더 카드가 남은 높이를 채운다(flex-1 min-h-0).
 *   3. 하단 — 학교 공지 카드를 세로 그리드로 배치한다.
 */
import { useRef, useState } from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatFullDate } from '../../utils/noticeDate'
import { NOTICE_CATEGORIES, categoryChipClass } from './noticeCategories'
import AcademicCalendarGrid from './AcademicCalendarGrid'

// 공지 그리드는 스크롤이 바닥에 가까워질 때마다 더 보여준다(응답이 이미 전체를
// 한 번에 내려주므로 추가 네트워크 호출 없이 노출 개수만 늘림).
const NOTICES_INITIAL_COUNT = 6
const NOTICES_STEP = 6
const NOTICES_SCROLL_END_THRESHOLD_PX = 80

export default function AcademicNoticesPCContent() {
  const [category, setCategory] = useState('all')

  const { data: calendarData, loading: calLoading } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  const allEvents = [next, ...upcoming].filter(Boolean)

  const { data: noticesData, loading: noticesLoading, error: noticesError } =
    useSchoolBoardNotices(category)
  const notices = Array.isArray(noticesData) ? noticesData : []

  const [visibleCount, setVisibleCount] = useState(NOTICES_INITIAL_COUNT)
  const scrollRef = useRef(null)
  // 렌더 중 조정 — effect로 미루면 이전 카테고리의 개수로 한 프레임이 그려진다.
  const [seenCategory, setSeenCategory] = useState(category)
  if (category !== seenCategory) {
    setSeenCategory(category)
    setVisibleCount(NOTICES_INITIAL_COUNT)
  }

  const visibleNotices = notices.slice(0, visibleCount)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const nearEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - NOTICES_SCROLL_END_THRESHOLD_PX
    if (nearEnd) {
      setVisibleCount((c) => Math.min(c + NOTICES_STEP, notices.length))
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 1. 헤더 — 카테고리 칩 행 */}
      <div role="group" aria-label="공지 카테고리 선택" className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
        {NOTICE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`pressable px-2.5 py-1.5 rounded-pill text-caption font-semibold transition-colors border ${
              category === c.id
                ? 'bg-accent-bg dark:bg-accent-bg text-accent-ink dark:text-accent-ink border-transparent ring-1 ring-accent dark:ring-accent'
                : 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute border-line dark:border-line'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 2~3. 본문(캘린더, 남은 높이를 채움) + 하단(학교 공지 그리드) */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto mt-4 flex flex-col gap-4">
        {!calLoading && allEvents.length > 0 && (
          <div className="flex-1 flex flex-col bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-4 py-4">
            <AcademicCalendarGrid events={allEvents} initialDate={next?.start_date ?? null} />
          </div>
        )}

        <div>
          <div
            className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
            style={{ letterSpacing: '0.14em' }}
          >
            학교 공지
          </div>

          {noticesLoading && (
            <p className="text-body text-mute dark:text-mute text-center py-8">불러오는 중이에요...</p>
          )}
          {noticesError && (
            <p className="text-body text-red-400 text-center py-8">공지사항을 불러오지 못했어요</p>
          )}
          {!noticesLoading && !noticesError && notices.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-mute dark:text-mute">
              <Megaphone size={28} aria-hidden="true" />
              <p className="text-body">이 카테고리의 새 공지가 없어요</p>
            </div>
          )}

          {notices.length > 0 && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleNotices.map((n) => (
                <a
                  key={`${n.category}-${n.id}`}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable hoverable bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-sh-card px-4 py-4 flex flex-col gap-2"
                  aria-label={`${n.title} · 원문 보기 (새 탭)`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-meta font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${categoryChipClass(n.category)}`}>
                      {n.category_label ?? n.category}
                    </span>
                    <span className="text-label font-semibold text-mute dark:text-mute">
                      {formatFullDate(n.published_at)}
                    </span>
                  </div>
                  <h3 className="text-body font-bold text-ink dark:text-ink leading-snug line-clamp-3 flex-1">
                    {n.title}
                  </h3>
                  <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 self-end" aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
