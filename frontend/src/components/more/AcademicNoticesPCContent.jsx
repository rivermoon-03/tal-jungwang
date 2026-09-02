/**
 * AcademicNoticesPCContent — 더보기 PC 레이아웃 우측 "학사공지" 콘텐츠.
 *
 * AcademicNoticesTab(모바일판)과 데이터 로직을 공유한다(훅/유틸 재사용, 로직 복제
 * 금지). 레이아웃만 PC 전용으로 재구성한다.
 *
 * DS1(2026-08): 학과 select를 제거하고 전교 게시판 카테고리 칩으로 대체.
 *   1. 상단 한 줄 헤더 — 카테고리 칩 행.
 *   2. 본문 — 캘린더 카드가 남은 높이를 채운다(flex-1 min-h-0).
 *   3. 하단 — 학교 공지 카드를 세로 그리드로 배치한다(안읽음 도트·마감 D-day 포함).
 */
import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Megaphone, RefreshCw } from 'lucide-react'
import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatFullDate } from '../../utils/noticeDate'
import { formatRelativeTime } from '../../utils/relativeTime'
import { formatNoticeDday, isNoticeDdayImminent } from '../../utils/noticeDeadline'
import { isNoticeUnread, markNoticesSeenByOwnCategory } from '../../utils/noticeReadState'
import { NOTICE_CATEGORIES, categoryChipClass } from './noticeCategories'
import AcademicCalendarGrid from './AcademicCalendarGrid'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../common/Skeleton'

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

  const { data: noticesData, loading: noticesLoading, error: noticesError, fetchedAt: noticesFetchedAt, refetch: refetchNotices } =
    useSchoolBoardNotices(category)
  const notices = Array.isArray(noticesData) ? noticesData : []

  // 계정이 없어 읽음 상태를 서버에 못 둔다 — AcademicNoticesTab(모바일판)과 동일하게
  // 응답이 도착할 때마다 그 안의 항목들을 기기 로컬에 "확인함"으로 남긴다.
  useEffect(() => {
    if (noticesLoading || noticesError) return
    if (Array.isArray(noticesData) && noticesData.length > 0) {
      markNoticesSeenByOwnCategory(noticesData)
    }
  }, [noticesData, noticesLoading, noticesError])

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
            {/* 결함: initialDate로 next?.start_date(진행 중이거나 가장 임박한
                학사일정의 시작일)를 넘겼었다. 모바일(AcademicNoticesTab)은 같은
                기본값을 쓰지만 "다가오는 학사일정" 리스트를 탭해 focusDate로
                덮어쓸 수 있는 상호작용이 있고, 리스트 자체가 "왜 그 날짜로
                이동했는지"를 보여준다. PC는 그 리스트가 없어 next.start_date가
                마운트 내내 고정된 기본 선택으로 남는다 — 사용자가 고른 적
                없는 날짜가 오늘 대신 채워져 보인다. PC에는 오늘을 넘긴다. */}
            <AcademicCalendarGrid events={allEvents} initialDate={null} />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            {/* 결함: uppercase + tracking-widest(인라인 letterSpacing 0.14em)는
                로마자 라벨용 값이다. 한글엔 uppercase가 아무 효과가 없고, 이
                정도 자간이면 낱글자가 흩어져 단어 사이가 두 칸처럼 보인다.
                라벨용 토큰 text-ghdr(letterSpacing 0.1em)로 정리한다. */}
            <div className="text-ghdr text-mute dark:text-mute">
              학교 공지
            </div>
            {/* 신선도 — "언제 기준 목록인지 + 새로고침" 한 줄. */}
            {!noticesLoading && !noticesError && noticesFetchedAt && (
              <div className="flex items-center gap-2">
                <span className="text-label text-mute dark:text-mute">
                  {formatRelativeTime(new Date(noticesFetchedAt))} 정보
                </span>
                <button
                  type="button"
                  onClick={refetchNotices}
                  className="pressable flex items-center gap-1 px-2 py-1 min-h-[44px] text-label font-semibold text-mute dark:text-mute"
                  aria-label="학교 공지 새로고침"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  새로고침
                </button>
              </div>
            )}
          </div>

          {/* 로딩 / 에러 / 빈 상태 / 정상 — 넷을 서로 다른 모양으로 구분한다. */}
          {noticesLoading && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-card border border-line dark:border-line px-4 py-4 space-y-2">
                  <Skeleton height="0.9rem" width="50%" />
                  <Skeleton height="2.5rem" />
                </div>
              ))}
            </div>
          )}
          {!noticesLoading && noticesError && (
            <ErrorState message="공지사항을 불러오지 못했어요" onRetry={refetchNotices} className="py-8" />
          )}
          {!noticesLoading && !noticesError && notices.length === 0 && (
            <EmptyState
              icon={<Megaphone size={28} aria-hidden="true" />}
              title="이 카테고리의 새 공지가 없어요"
              desc={category !== 'all' ? '전체 카테고리에는 다른 공지가 있을 수 있어요' : undefined}
              actionLabel={category !== 'all' ? '전체 카테고리 보기' : undefined}
              onAction={category !== 'all' ? () => setCategory('all') : undefined}
              className="py-8"
            />
          )}

          {!noticesLoading && !noticesError && notices.length > 0 && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleNotices.map((n) => {
                const unread = isNoticeUnread(n.category, n.id)
                const dday = formatNoticeDday(n.title, n.published_at)
                const imminent = isNoticeDdayImminent(n.title, n.published_at)
                return (
                  <a
                    key={`${n.category}-${n.id}`}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`pressable hoverable bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-sh-card px-[18px] py-4 flex flex-col gap-2 min-h-[44px] ${
                      unread ? '' : 'opacity-70'
                    }`}
                    aria-label={`${unread ? '안읽음 · ' : ''}${n.title} · 원문 보기 (새 탭)`}
                  >
                    <div className="flex items-center gap-2">
                      {/* 안읽음 도트 — 읽은 항목도 자리는 그대로 비워 정렬이 흔들리지 않는다. */}
                      <span
                        aria-hidden="true"
                        className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
                      />
                      <span className={`text-meta font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${categoryChipClass(n.category)}`}>
                        {n.category_label ?? n.category}
                      </span>
                      <span className="text-caption text-mute dark:text-mute">
                        {formatFullDate(n.published_at)}
                      </span>
                      {/* D-day — 우측 정렬, 배경 없이 색으로만 임박을 알린다. */}
                      {dday && (
                        <span
                          className={`ml-auto text-chip font-extrabold tabular-nums flex-shrink-0 ${
                            imminent ? 'text-imminent' : 'text-mute dark:text-mute'
                          }`}
                        >
                          {dday}
                        </span>
                      )}
                    </div>
                    <h3 className="text-list-nm text-ink dark:text-ink leading-snug line-clamp-3 flex-1">
                      {n.title}
                    </h3>
                    <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 self-end" aria-hidden="true" />
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
