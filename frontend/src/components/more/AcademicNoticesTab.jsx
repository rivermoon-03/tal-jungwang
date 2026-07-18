/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭.
 *
 * - 학과 선택 드롭다운 (/school/departments — 옵션이 늘어나도 그대로 동작, 하드코딩 금지)
 * - D-day 배너 + 다가오는 일정 (/school/calendar)
 * - 선택된 학과의 공지 리스트 (/school/notices?department=...)
 *
 * 원문 링크는 새 탭(`target="_blank"`)으로 열되 reverse tabnabbing 방지를 위해
 * `rel="noopener noreferrer"`를 항상 붙인다.
 */
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronDown, ExternalLink, Megaphone } from 'lucide-react'
import { useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange, dateBadgeParts } from '../../utils/academicCalendar'
import { formatFullDate } from '../../utils/noticeDate'

// 공지는 useSchoolNotices가 이미 전체(최대 50건)를 한 번에 내려주므로,
// 추가 네트워크 호출 없이 "화면에 몇 개를 보여줄지"만 스크롤에 맞춰 늘린다.
const NOTICES_INITIAL_COUNT = 3
const NOTICES_STEP = 3
const NOTICES_SCROLL_END_THRESHOLD_PX = 80

export default function AcademicNoticesTab() {
  const { data: departmentsData, loading: deptLoading } = useSchoolDepartments()
  const departments = Array.isArray(departmentsData) ? departmentsData : []

  // 사용자가 직접 고른 학과(없으면 null). 목록이 로드되기 전엔 고를 수 없으므로,
  // 화면에 실제로 쓰는 값은 아래 selectedDept — "사용자가 골랐으면 그 값, 아니면
  // 로드된 목록의 첫 학과"로 렌더링 중 계산한다. 목록이 나중에 늘어나도 이미
  // 고른 값은 그대로 유지된다(effect+setState로 강제 리셋하지 않음).
  const [manualDept, setManualDept] = useState(null)
  const selectedDept = manualDept ?? departments[0]?.code ?? null

  const { data: calendarData, loading: calLoading } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []

  const { data: noticesData, loading: noticesLoading, error: noticesError } = useSchoolNotices(selectedDept)
  const notices = Array.isArray(noticesData) ? noticesData : []

  const selectedDeptLabel = departments.find((d) => d.code === selectedDept)?.label ?? ''

  // 학과가 바뀌어 공지 목록 자체가 교체되면 보이는 개수도 처음 3개로 되돌린다.
  const [visibleCount, setVisibleCount] = useState(NOTICES_INITIAL_COUNT)
  const noticesScrollRef = useRef(null)
  useEffect(() => {
    setVisibleCount(NOTICES_INITIAL_COUNT)
  }, [selectedDept])

  const visibleNotices = notices.slice(0, visibleCount)

  const handleNoticesScroll = () => {
    const el = noticesScrollRef.current
    if (!el) return
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - NOTICES_SCROLL_END_THRESHOLD_PX
    if (nearEnd) {
      setVisibleCount((c) => Math.min(c + NOTICES_STEP, notices.length))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 학과 선택 드롭다운 */}
      {departments.length > 0 && (
        <div className="relative">
          <select
            value={selectedDept ?? ''}
            onChange={(e) => setManualDept(e.target.value)}
            aria-label="학과 선택"
            className="w-full appearance-none bg-surface dark:bg-surface border border-line dark:border-line rounded-input pl-4 pr-10 py-3 text-body font-semibold text-ink dark:text-ink"
          >
            {departments.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-mute dark:text-mute"
          />
        </div>
      )}
      {deptLoading && departments.length === 0 && (
        <p className="text-body text-mute dark:text-mute text-center py-4">학과 목록을 불러오는 중이에요...</p>
      )}

      {/* 가장 임박한 일정 — 컴팩트 한 줄 배너. [아이콘][D-N][제목(truncate)][날짜] */}
      {!calLoading && next && (
        <div className="bg-accent-bg dark:bg-accent-bg rounded-card border border-line dark:border-line px-3.5 py-2.5 flex items-center gap-2.5">
          <CalendarDays size={16} className="text-accent-ink dark:text-accent flex-shrink-0" aria-hidden="true" />
          <span className="text-body font-bold text-accent-ink dark:text-accent truncate flex-1 min-w-0">
            {`${formatDday(next.start_date)} · ${next.title}`}
          </span>
          <span className="text-label font-semibold text-mute dark:text-mute flex-shrink-0 whitespace-nowrap">
            {formatDateOrRange(next.start_date, next.end_date)}
          </span>
        </div>
      )}

      {/* 다가오는 일정 — 캘린더식 아젠다(좌측 날짜 배지 + 제목). 긴 리스트 대신 컴팩트. */}
      {upcoming.length > 0 && (
        <div>
          <div
            className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
            style={{ letterSpacing: '0.14em' }}
          >
            다가오는 일정
          </div>
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
            {upcoming.map((ev, i) => {
              const badge = dateBadgeParts(ev.start_date)
              return (
                <div key={`${ev.title}-${ev.start_date}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                  {/* 캘린더 셀 느낌의 날짜 배지 (월 작게 / 일 크게) */}
                  <div className="flex-shrink-0 w-11 rounded-mini bg-surface-2 dark:bg-bg border border-line dark:border-line flex flex-col items-center justify-center py-1 leading-none">
                    <span className="text-micro font-bold text-mute dark:text-mute">{badge ? `${badge.month}월` : ''}</span>
                    <span className="text-body font-extrabold text-ink dark:text-ink tabular-nums mt-0.5">{badge ? badge.day : ''}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold text-ink dark:text-ink truncate">{ev.title}</p>
                    <p className="text-label font-semibold text-mute dark:text-mute mt-0.5 truncate">
                      {formatDateOrRange(ev.start_date, ev.end_date)}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 학과 공지 리스트 */}
      <div>
        <div
          className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
          style={{ letterSpacing: '0.14em' }}
        >
          학과 공지
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
            <p className="text-body">새 학과 공지가 없어요</p>
          </div>
        )}

        {notices.length > 0 && (
          <div
            ref={noticesScrollRef}
            onScroll={handleNoticesScroll}
            data-testid="notices-scroll"
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4"
          >
            {visibleNotices.map((n) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable shrink-0 w-64 bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-sh-card px-4 py-4 flex flex-col gap-2"
                aria-label={`${n.title} — 원문 보기 (새 탭)`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-meta font-bold text-chip-blue-fg dark:text-chip-blue-fg bg-chip-blue-bg dark:bg-chip-blue-bg px-2 py-0.5 rounded-full flex-shrink-0">
                    {selectedDeptLabel || '학과'}
                  </span>
                  <span className="text-label font-semibold text-mute dark:text-mute">{formatFullDate(n.published_at)}</span>
                </div>
                <h3 className="text-body font-bold text-ink dark:text-ink leading-snug line-clamp-3 flex-1">{n.title}</h3>
                <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 self-end" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
