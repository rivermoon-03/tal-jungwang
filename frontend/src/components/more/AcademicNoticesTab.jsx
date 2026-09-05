/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭.
 *
 * DS1(2026-08) 개편: 학과 선택 드롭다운 + 학과 공지(컴공 RSS 단일)를 제거하고
 * 전교 게시판 카테고리(학사/장학/취업/비교과/생활관) 칩 필터로 대체했다.
 * 학과 공지는 컴공 한 곳만 지원되는 반쪽 기능이었고, 실수요(장학·취업)는
 * 전교 게시판에 있다.
 *
 * 순서(정보 우선순위 재정렬 — 결함: "공지" 탭인데 첫 화면에 공지가 없었다):
 *   1. 카테고리 칩 행 — 학교 공지 목록의 필터라 목록 바로 위에 둔다.
 *   2. 학교 공지 — 탭 이름이 약속하는 실제 콘텐츠. 예전엔 카테고리 칩 다음에
 *      "다가오는 학사일정" 대문 카드와 캘린더가 화면을 다 채워, 공지 탭을 열어도
 *      한참 스크롤해야 공지가 나왔다. 캘린더/일정은 없애지 않되 보조 정보로
 *      아래로 내린다 — 탭을 여는 주된 의도는 공지를 읽는 것이지 일정을 보는
 *      것이 아니다.
 *   3. 진행 중인 학사일정 — D+day 칩(이미 시작한 일정). "다가오는"과 섞여 있으면
 *      이미 시작한 일정이 "앞으로 올 일"처럼 읽혀 혼란스럽다(결함: D+3짜리
 *      수강정정이 "다가오는" 목록 맨 위에 있었다). 진행 중인 일정이 더 급한
 *      정보일 수 있어 없애지 않고 별도 그룹으로 먼저 보여준다.
 *   4. 다가오는 학사일정 — D-day 칩(아직 시작 전), 상위 4개.
 *   5. 캘린더 — AcademicCalendarGrid(주간 스트립 기본, 월 전체보기는 내부 토글).
 *
 * 진행 중/다가오는 구분은 utils/academicCalendar.js의 isEventInProgress/
 * isEventUpcoming으로 판정한다(순수 날짜 비교 재사용 — 인라인 계산 금지).
 * 학교 공지 행은 한 카드 안에 구분선(divide-y)으로 나뉜다. 각 행은
 * "안읽음 도트 + 카테고리 태그 + D-day(우측 정렬)" 한 줄, 그 아래 제목,
 * 그 아래 날짜 순서다. 읽은 행은 opacity로 흐리게 처리하되 도트 자리는
 * 비워서 유지한다(정렬 유지).
 *
 * 원문 링크는 새 탭(`target="_blank"`)으로 열되 reverse tabnabbing 방지를 위해
 * `rel="noopener noreferrer"`를 항상 붙인다.
 */
import { useEffect, useState } from 'react'
import { ExternalLink, Megaphone, RefreshCw } from 'lucide-react'
import { useSchoolBoardNotices, useAcademicCalendar } from '../../hooks/useMore'
import {
  formatDday,
  formatDateOrRange,
  isEventInProgress,
  isEventUpcoming,
} from '../../utils/academicCalendar'
import { formatFullDate } from '../../utils/noticeDate'
import { formatRelativeTime } from '../../utils/relativeTime'
import { formatNoticeDday, isNoticeDdayImminent } from '../../utils/noticeDeadline'
import { isNoticeUnread, markNoticesSeenByOwnCategory } from '../../utils/noticeReadState'
import { NOTICE_CATEGORIES, categoryChipClass } from './noticeCategories'
import AcademicCalendarGrid from './AcademicCalendarGrid'
import UpcomingScheduleModal from './UpcomingScheduleModal'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../common/Skeleton'

// "다가오는 학사일정" 리스트에 인라인으로 보여줄 최대 개수. 그보다 많으면
// 나머지는 "전체 일정 보기"로 모달에서 본다.
const UPCOMING_LIST_MAX = 4

// 공지는 카테고리당 최대 30건(전체 60건)이 한 번에 내려오므로,
// 추가 네트워크 호출 없이 "화면에 몇 개를 보여줄지"만 늘린다.
const NOTICES_INITIAL_COUNT = 5
const NOTICES_STEP = 5

// 실제 공지 행(제목 2줄 + 뱃지/날짜 줄)과 같은 컨테이너·행 수를 가진 로딩
// 자리표시자 — 텍스트("불러오는 중이에요")로는 결과와 모양이 안 겹쳐 레이아웃이
// 튀었다.
function NoticeListSkeleton() {
  return (
    <div className="rounded-card border border-line dark:border-line divide-y divide-line dark:divide-line overflow-hidden" aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-4 py-3 space-y-2">
          <Skeleton height="0.9rem" width="85%" />
          <Skeleton height="0.75rem" width="40%" />
        </div>
      ))}
    </div>
  )
}

// "진행 중인 학사일정"과 "다가오는 학사일정"이 공유하는 행 목록 — D-day 칩(둘 다
// formatDday 그대로 씀, 진행 중이면 D+N/D-DAY, 다가오는이면 D-N) + 제목 + 기간.
function EventListCard({ heading, events, focusDate, onSelect }) {
  return (
    <div>
      <div
        className="text-label font-semibold text-mute dark:text-mute uppercase mb-2"
        style={{ letterSpacing: '-0.02em' }}
      >
        {heading}
      </div>
      <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card divide-y divide-line dark:divide-line overflow-hidden">
        {events.map((ev) => (
          <button
            key={`${ev.title}-${ev.start_date}`}
            type="button"
            onClick={() => onSelect(ev.start_date)}
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
    </div>
  )
}

export default function AcademicNoticesTab() {
  const [category, setCategory] = useState('all')

  const { data: calendarData, loading: calLoading } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  // 캘린더 그리드가 쓰는 전체 이벤트(가장 임박한 일정 + 그 다음 일정들).
  const allEvents = [next, ...upcoming].filter(Boolean)
  // "진행 중"(이미 시작해 아직 안 끝남)과 "다가오는"(아직 시작 전)을 나눈다 —
  // 서로 배타적이라 한 이벤트가 두 목록에 동시에 들어가지 않는다(이미 끝난
  // 일정은 어느 쪽에도 들지 않는다 — 백엔드가 이미 걸러 보내지만 방어적으로도
  // 같은 규칙을 쓴다).
  const progressEvents = allEvents.filter((ev) => isEventInProgress(ev))
  const upcomingEvents = allEvents.filter((ev) => isEventUpcoming(ev))
  const upcomingList = upcomingEvents.slice(0, UPCOMING_LIST_MAX)
  const hasMoreEvents = upcomingEvents.length > upcomingList.length

  // "전체 일정 보기" 모달(4개보다 많을 때만 필요).
  const [showAllEvents, setShowAllEvents] = useState(false)

  // 리스트 항목을 탭하면 그 날짜로 캘린더를 이동시킨다(key 재마운트 방식 —
  // AcademicCalendarGrid가 자체 상태를 캡슐화하고 있어서).
  //
  // 처음 열 때는 오늘이 선택돼야 한다. 예전에는 focusDate 가 없으면 다가오는
  // 학사일정의 시작일(next.start_date)로 떨어졌는데, 사용자가 고른 적 없는 날이
  // 선택으로 칠해져서 열렸다. 캘린더가 "채움은 선택, 점은 오늘" 로 두 신호를
  // 나눠 쓰는 지금은 그게 어느 쪽이 오늘인지 헷갈리게 만든다. 탭했을 때만
  // 그 날로 옮기고, 기본은 캘린더 자체 기본값(오늘)에 맡긴다.
  const [focusDate, setFocusDate] = useState(null)
  const calendarInitialDate = focusDate

  const { data: noticesData, loading: noticesLoading, error: noticesError, fetchedAt: noticesFetchedAt, refetch: refetchNotices } =
    useSchoolBoardNotices(category)
  const notices = Array.isArray(noticesData) ? noticesData : []

  // 계정이 없어 읽음 상태를 서버에 못 둔다 — 응답이 도착할 때마다(카테고리 전환
  // 포함) 그 안의 항목들을 "확인함"으로 로컬에 남긴다. 안읽음 도트는 이 기록보다
  // 큰 id만 켜진다(noticeReadState.js).
  useEffect(() => {
    if (noticesLoading || noticesError) return
    if (Array.isArray(noticesData) && noticesData.length > 0) {
      markNoticesSeenByOwnCategory(noticesData)
    }
  }, [noticesData, noticesLoading, noticesError])

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
      {/* 카테고리 칩 + 학교 공지 목록을 한 블록으로 묶는다(칩은 목록의 필터라
          붙어 있어야 읽힌다). "학교 공지" 소제목은 두지 않는다 — 탭 이름이 이미
          같은 뜻이고, 그 한 줄만큼 목록이 멀어졌다. */}
      <div className="flex flex-col gap-2">
      <div role="group" aria-label="공지 카테고리 선택" className="flex flex-wrap items-center gap-1.5">
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

      {/* 학교 공지 — 탭 이름이 약속하는 콘텐츠라 칩 바로 다음, 학사일정/캘린더보다
          먼저 보여준다(정보 우선순위 재정렬). */}
      <div aria-label="학교 공지 목록">
        {/* 로딩 / 에러 / 빈 상태 / 정상 — 넷을 서로 다른 모양으로 구분한다. */}
        {noticesLoading && <NoticeListSkeleton />}

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
          <>
            <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card divide-y divide-line dark:divide-line overflow-hidden">
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
                    className={`pressable flex items-start gap-3 px-[18px] py-3 min-h-[44px] ${unread ? '' : 'opacity-70'}`}
                    aria-label={`${unread ? '안읽음 · ' : ''}${n.title} · 원문 보기 (새 탭)`}
                  >
                    {/* 안읽음 도트 — 읽은 항목도 자리는 그대로 비워 정렬이 흔들리지 않는다. */}
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
                    />
                    <div className="min-w-0 flex-1">
                      {/* 카테고리 태그 + D-day(우측 정렬) — D-day는 배경 없이 색으로만 임박을 알린다. */}
                      <div className="flex items-center gap-1.5">
                        <span className={`text-meta font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${categoryChipClass(n.category)}`}>
                          {n.category_label ?? n.category}
                        </span>
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
                      <h3 className="text-list-nm text-ink dark:text-ink leading-snug line-clamp-2 mt-1">{n.title}</h3>
                      <p className="text-caption text-mute dark:text-mute mt-0.5">{formatFullDate(n.published_at)}</p>
                    </div>
                    <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 mt-0.5" aria-hidden="true" />
                  </a>
                )
              })}
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

            {/* 신선도 행 — "언제 기준 목록인지 + 새로고침" 한 줄. */}
            {noticesFetchedAt && (
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-label text-mute dark:text-mute">
                  {formatRelativeTime(new Date(noticesFetchedAt))} 정보
                </span>
                <button
                  type="button"
                  onClick={refetchNotices}
                  className="pressable flex items-center gap-1 px-2 py-1 -mr-2 min-h-[44px] text-label font-semibold text-mute dark:text-mute"
                  aria-label="학교 공지 새로고침"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  새로고침
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </div>

      {/* 학사일정 — 보조 정보라 공지 목록 다음으로 내렸다. 진행 중(D+N/D-DAY)과
          다가오는(D-N)을 별도 카드로 나눈다: 진행 중인 일정이 "다가오는" 이름
          아래 섞이면 이미 시작한 일이 앞으로 올 일처럼 읽힌다. */}
      {calLoading && (
        <div className="rounded-card border border-line dark:border-line p-3 space-y-2" aria-hidden="true">
          <Skeleton height="0.9rem" width="40%" />
          <Skeleton height="2.5rem" />
          <Skeleton height="2.5rem" />
        </div>
      )}

      {!calLoading && progressEvents.length > 0 && (
        <EventListCard
          heading="진행 중인 학사일정"
          events={progressEvents}
          focusDate={focusDate}
          onSelect={setFocusDate}
        />
      )}

      {!calLoading && upcomingList.length > 0 && (
        <div>
          <EventListCard
            heading="다가오는 학사일정"
            events={upcomingList}
            focusDate={focusDate}
            onSelect={setFocusDate}
          />
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
