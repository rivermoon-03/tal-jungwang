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
import { useState } from 'react'
import { CalendarDays, ChevronDown, ExternalLink, Megaphone } from 'lucide-react'
import { useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange } from '../../utils/academicCalendar'
import { formatFullDate } from '../../utils/noticeDate'

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

      {/* D-day 배너 */}
      {!calLoading && next && (
        <div className="bg-accent-bg dark:bg-accent-bg rounded-card border border-line dark:border-line px-4 py-4 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-mini bg-accent flex items-center justify-center text-white flex-shrink-0"
            aria-hidden="true"
          >
            <CalendarDays size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-body font-bold text-accent-ink dark:text-accent">
              {formatDday(next.start_date)} · {next.title}
            </p>
            <p className="text-label font-semibold text-mute dark:text-mute mt-0.5">
              {formatDateOrRange(next.start_date, next.end_date)}
            </p>
          </div>
        </div>
      )}

      {/* 다가오는 일정 */}
      {upcoming.length > 0 && (
        <div>
          <div
            className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
            style={{ letterSpacing: '0.14em' }}
          >
            다가오는 일정
          </div>
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card overflow-hidden divide-y divide-line dark:divide-line">
            {upcoming.map((ev, i) => (
              <div key={`${ev.title}-${ev.start_date}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="text-body font-semibold text-ink dark:text-ink">{ev.title}</span>
                <span className="text-label font-semibold text-mute dark:text-mute flex-shrink-0">
                  {formatDateOrRange(ev.start_date, ev.end_date)}
                </span>
              </div>
            ))}
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

        <div className="flex flex-col gap-3">
          {notices.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pressable bg-surface dark:bg-surface rounded-card border border-line dark:border-line shadow-sh-card px-4 py-4 flex items-start gap-3"
              aria-label={`${n.title} — 원문 보기 (새 탭)`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-meta font-bold text-chip-blue-fg dark:text-chip-blue-fg bg-chip-blue-bg dark:bg-chip-blue-bg px-2 py-0.5 rounded-full flex-shrink-0">
                    {selectedDeptLabel || '학과'}
                  </span>
                  <span className="text-label font-semibold text-mute dark:text-mute">{formatFullDate(n.published_at)}</span>
                </div>
                <h3 className="text-body font-bold text-ink dark:text-ink leading-snug">{n.title}</h3>
              </div>
              <ExternalLink size={16} className="text-mute dark:text-mute flex-shrink-0 mt-1" aria-hidden="true" />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
