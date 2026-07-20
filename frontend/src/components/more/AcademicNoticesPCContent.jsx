/**
 * AcademicNoticesPCContent — 더보기 PC 레이아웃 우측 "학사공지" 콘텐츠.
 *
 * AcademicNoticesTab(모바일판)과 데이터 로직을 공유한다(훅/유틸 재사용, 로직 복제
 * 금지). 레이아웃만 PC 전용으로 재구성한다.
 *
 *   1. 상단 한 줄 헤더 — 학과 select.
 *      AcademicCalendarGrid는 월/주 세그먼트·이전/다음 달 내비게이션을 자체
 *      상태(cursor/weekAnchor/selectedDate/viewMode)로 캡슐화하고 있어, 이를
 *      헤더로 끌어올리려면 그 상태 전부를 부모로 리프팅하고 컴포넌트를
 *      controlled로 다시 설계해야 한다. 기존 파일을 건드리지 않는 제약 하에서는
 *      과하게 침습적인 리팩터라, 보수적으로 헤더에는 학과 select만 두고
 *      캘린더는 내장 컨트롤을 그대로 쓴다.
 *   2. 본문 — 캘린더 카드가 남은 높이를 채운다(flex-1 min-h-0).
 *   3. 하단(공간이 남으면) — 학과 공지 카드를 세로 그리드로 배치한다.
 */
import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Info, Megaphone } from 'lucide-react'
import { useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatFullDate } from '../../utils/noticeDate'
import AcademicCalendarGrid from './AcademicCalendarGrid'

// 공지 그리드는 스크롤이 바닥에 가까워질 때마다 더 보여준다(useSchoolNotices가
// 이미 전체를 한 번에 내려주므로 추가 네트워크 호출 없이 노출 개수만 늘림).
const NOTICES_INITIAL_COUNT = 6
const NOTICES_STEP = 6
const NOTICES_SCROLL_END_THRESHOLD_PX = 80

export default function AcademicNoticesPCContent() {
  const { data: departmentsData, loading: deptLoading } = useSchoolDepartments()
  const departments = Array.isArray(departmentsData) ? departmentsData : []

  const [manualDept, setManualDept] = useState(null)
  const selectedDept = manualDept ?? departments[0]?.code ?? null

  const { data: calendarData, loading: calLoading } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  const allEvents = [next, ...upcoming].filter(Boolean)

  const selectedDeptInfo = departments.find((d) => d.code === selectedDept) ?? null
  const selectedDeptLabel = selectedDeptInfo?.label ?? ''
  // supported 필드가 없는 이전 응답/모킹은 지원 학과로 취급한다(기본값 true).
  const isDeptSupported = selectedDeptInfo?.supported ?? true

  // robots.txt 정책상 아직 지원하지 않는 학과는 API를 아예 호출하지 않는다.
  const { data: noticesData, loading: noticesLoading, error: noticesError } = useSchoolNotices(
    isDeptSupported ? selectedDept : null
  )
  const notices = Array.isArray(noticesData) ? noticesData : []

  const [visibleCount, setVisibleCount] = useState(NOTICES_INITIAL_COUNT)
  const scrollRef = useRef(null)
  useEffect(() => {
    setVisibleCount(NOTICES_INITIAL_COUNT)
  }, [selectedDept])

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
      {/* 1. 헤더 — 학과 select만 (보수적 구성, 사유는 파일 상단 주석 참고) */}
      <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
        {departments.length > 0 && (
          <div className="relative w-[280px]">
            <select
              value={selectedDept ?? ''}
              onChange={(e) => setManualDept(e.target.value)}
              aria-label="학과 선택"
              className="w-full appearance-none bg-surface dark:bg-surface border border-line dark:border-line rounded-input pl-4 pr-10 py-2.5 text-body font-semibold text-ink dark:text-ink"
            >
              {departments.map((d) => (
                <option
                  key={d.code}
                  value={d.code}
                  title={d.supported === false ? d.unsupported_reason : undefined}
                >
                  {d.label}
                  {d.supported === false ? ' (준비 중)' : ''}
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
          <p className="text-body text-mute dark:text-mute">학과 목록을 불러오는 중이에요...</p>
        )}
      </div>

      {/* 2~3. 본문(캘린더, 남은 높이를 채움) + 하단(공간이 남으면 학과 공지) */}
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
            학과 공지
          </div>

          {!isDeptSupported && selectedDeptInfo && (
            <div
              role="note"
              aria-label={`${selectedDeptLabel} 학과 공지 미지원 안내`}
              className="flex items-start gap-2 bg-accent-bg dark:bg-accent-bg border border-line dark:border-line rounded-card px-4 py-3"
            >
              <Info size={18} className="text-mute dark:text-mute flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-body text-mute dark:text-mute">{selectedDeptInfo.unsupported_reason}</p>
            </div>
          )}

          {isDeptSupported && noticesLoading && (
            <p className="text-body text-mute dark:text-mute text-center py-8">불러오는 중이에요...</p>
          )}
          {isDeptSupported && noticesError && (
            <p className="text-body text-red-400 text-center py-8">공지사항을 불러오지 못했어요</p>
          )}
          {isDeptSupported && !noticesLoading && !noticesError && notices.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-mute dark:text-mute">
              <Megaphone size={28} aria-hidden="true" />
              <p className="text-body">새 학과 공지가 없어요</p>
            </div>
          )}

          {isDeptSupported && notices.length > 0 && (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleNotices.map((n) => (
                <a
                  key={n.id}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pressable bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-sh-card px-4 py-4 flex flex-col gap-2"
                  aria-label={`${n.title} — 원문 보기 (새 탭)`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-meta font-bold text-chip-blue-fg dark:text-chip-blue-fg bg-chip-blue-bg dark:bg-chip-blue-bg px-2 py-0.5 rounded-full flex-shrink-0">
                      {selectedDeptLabel || '학과'}
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
