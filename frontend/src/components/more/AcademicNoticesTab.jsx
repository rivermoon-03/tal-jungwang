/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭.
 *
 * DS1(2026-08) 개편: 학과 선택 드롭다운 + 학과 공지(컴공 RSS 단일)를 제거하고
 * 전교 게시판 카테고리(학사/장학/취업/비교과/생활관) 칩 필터로 대체했다.
 * 학과 공지는 컴공 한 곳만 지원되는 반쪽 기능이었고, 실수요(장학·취업)는
 * 전교 게시판에 있다.
 *
 * 순서:
 *   1. 다가오는 학사일정 리스트(대문) — D-day 칩 + 제목 + 기간, 상위 4개.
 *   2. 캘린더 — AcademicCalendarGrid(주간 스트립 기본, 월 전체보기는 내부 토글).
 *   3. 학교 공지 — 카테고리 칩 행 + 세로 리스트(카테고리 뱃지/제목/날짜).
 *
 * 원문 링크는 새 탭(`target="_blank"`)으로 열되 reverse tabnabbing 방지를 위해
 * `rel="noopener noreferrer"`를 항상 붙인다.
 */
import { useState } from 'react'
import { ExternalLink, Megaphone } from 'lucide-react'
import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange } from '../../utils/academicCalendar'
import { formatFullDate } from '../../utils/noticeDate'
import { NOTICE_CATEGORIES, categoryChipClass } from './noticeCategories'
import AcademicCalendarGrid from './AcademicCalendarGrid'
import UpcomingScheduleModal from './UpcomingScheduleModal'

// "다가오는 학사일정" 리스트에 인라인으로 보여줄 최대 개수. 그보다 많으면
// 나머지는 "전체 일정 보기"로 모달에서 본다.
const UPCOMING_LIST_MAX = 4

// 공지는 카테고리당 최대 30건(전체 60건)이 한 번에 내려오므로,
// 추가 네트워크 호출 없이 "화면에 몇 개를 보여줄지"만 늘린다.
const NOTICES_INITIAL_COUNT = 5
const NOTICES_STEP = 5

export default function AcademicNoticesTab() {
  const [category, setCategory] = useState('all')

  const { data: calendarData, loading: calLoading } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  // 캘린더 그리드 + "다가오는 학사일정" 리스트가 공유하는 전체 이벤트(가장
  // 임박한 일정 + 그 다음 일정들) — 표시 개수만 리스트 쪽에서 자른다.
  const allEvents = [next, ...upcoming].filter(Boolean)
  const upcomingList = allEvents.slice(0, UPCOMING_LIST_MAX)
  const hasMoreEvents = allEvents.length > upcomingList.length

  // "전체 일정 보기" 모달(4개보다 많을 때만 필요).
  const [showAllEvents, setShowAllEvents] = useState(false)

  // 리스트 항목을 탭하면 그 날짜로 캘린더를 이동시킨다(key 재마운트 방식 —
  // AcademicCalendarGrid가 자체 상태를 캡슐화하고 있어서).
  const [focusDate, setFocusDate] = useState(null)
  const calendarInitialDate = focusDate ?? next?.start_date ?? null

  const { data: noticesData, loading: noticesLoading, error: noticesError } =
    useSchoolBoardNotices(category)
  const notices = Array.isArray(noticesData) ? noticesData : []

  // 카테고리가 바뀌어 목록 자체가 교체되면 보이는 개수도 처음 N개로 되돌린다.
  // 렌더 중 조정 — effect로 미루면 이전 카테고리의 개수로 한 프레임이 그려진다.
  const [visibleCount, setVisibleCount] = useState(NOTICES_INITIAL_COUNT)
  const [seenCategory, setSeenCategory] = useState(category)
  if (category !== seenCategory) {
    setSeenCategory(category)
    setVisibleCount(NOTICES_INITIAL_COUNT)
  }

  const visibleNotices = notices.slice(0, visibleCount)
  const hasMoreNotices = visibleCount < notices.length

  return (
    <div className="flex flex-col gap-4">
      {/* 다가오는 학사일정 — 대문. D-day 칩 + 제목 + 기간, 상위 4개. */}
      {!calLoading && upcomingList.length > 0 && (
        <div>
          <div
            className="text-label font-semibold text-mute dark:text-mute uppercase mb-2"
            style={{ letterSpacing: '-0.02em' }}
          >
            다가오는 학사일정
          </div>
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card divide-y divide-line dark:divide-line overflow-hidden">
            {upcomingList.map((ev) => (
              <button
                key={`${ev.title}-${ev.start_date}`}
                type="button"
                onClick={() => setFocusDate(ev.start_date)}
                aria-label={`${ev.title} · 캘린더에서 보기`}
                aria-pressed={focusDate === ev.start_date}
                className={`pressable w-full flex items-center gap-2 px-3 py-2.5 text-left ${
                  focusDate === ev.start_date ? 'bg-accent-bg dark:bg-accent-bg' : ''
                }`}
              >
                <span className="text-dest font-bold px-2 py-0.5 rounded-full bg-accent dark:bg-accent text-white dark:text-ink tracking-wide flex-shrink-0 tabular-nums">
                  {formatDday(ev.start_date)}
                </span>
                <span className="text-label font-bold text-ink dark:text-ink truncate flex-1 min-w-0">
                  {ev.title}
                </span>
                <span className="text-dest font-semibold text-mute dark:text-mute flex-shrink-0 whitespace-nowrap">
                  {formatDateOrRange(ev.start_date, ev.end_date)}
                </span>
              </button>
            ))}
          </div>
          {hasMoreEvents && (
            <button
              type="button"
              onClick={() => setShowAllEvents(true)}
              className="pressable w-full text-center text-dest font-semibold text-mute dark:text-mute py-2"
            >
              전체 일정 보기
            </button>
          )}
        </div>
      )}

      {/* 캘린더 — focusDate가 바뀌면 그 날짜로 다시 마운트해 이동을 반영 */}
      {!calLoading && allEvents.length > 0 && (
        <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-3 py-3">
          <AcademicCalendarGrid
            key={calendarInitialDate ?? 'none'}
            events={allEvents}
            initialDate={calendarInitialDate}
          />
        </div>
      )}

      {/* 학교 공지 — 카테고리 칩 + 세로 리스트 */}
      <div>
        <div
          className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
          style={{ letterSpacing: '0.14em' }}
        >
          학교 공지
        </div>

        <div role="group" aria-label="공지 카테고리 선택" className="flex flex-wrap items-center gap-1.5 mb-3">
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
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card divide-y divide-line dark:divide-line overflow-hidden">
            {visibleNotices.map((n) => (
              <a
                key={`${n.category}-${n.id}`}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable flex items-start justify-between gap-3 px-4 py-3"
                aria-label={`${n.title} · 원문 보기 (새 탭)`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-label font-bold text-ink dark:text-ink leading-snug line-clamp-2">{n.title}</h3>
                  <p className="text-dest font-semibold text-mute dark:text-mute mt-1 flex items-center gap-1.5">
                    <span className={`px-1.5 py-0.5 rounded-full font-bold ${categoryChipClass(n.category)}`}>
                      {n.category_label ?? n.category}
                    </span>
                    {formatFullDate(n.published_at)}
                  </p>
                </div>
                <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 mt-0.5" aria-hidden="true" />
              </a>
            ))}
            {hasMoreNotices && (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => Math.min(c + NOTICES_STEP, notices.length))}
                className="pressable w-full text-center text-dest font-semibold text-mute dark:text-mute py-3"
              >
                더 보기 ({notices.length - visibleCount}개 더)
              </button>
            )}
          </div>
        )}
      </div>

      <UpcomingScheduleModal
        open={showAllEvents}
        onClose={() => setShowAllEvents(false)}
        items={allEvents}
        onSelect={(ev) => {
          setFocusDate(ev.start_date)
          setShowAllEvents(false)
        }}
      />
    </div>
  )
}
