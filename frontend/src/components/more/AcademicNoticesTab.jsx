/**
 * AcademicNoticesTab — 더보기 "학사공지" 탭.
 *
 * 결함 #34/#7/#10 — 예전 순서(학과 드롭다운 → D-day 배너 1개 → 거대 월간
 * 캘린더 → 학과 공지 가로 스크롤)는 우선순위가 뒤집혀 있었다: 가장 자주
 * 찾는 "다가오는 일정"은 배너 한 줄로 축소돼 있고, 화면의 절반은 이번 달과
 * 무관한 날짜로 채워진 월간 캘린더가 차지했다. 학과 공지는 가로 스크롤이라
 * 뷰포트 밖까지 카드가 삐져나갔다.
 *
 * 새 순서:
 *   1. 학과 선택 드롭다운
 *   2. 다가오는 학사일정 리스트(대문) — D-day 칩 + 제목 + 기간, 상위 4개.
 *      탭하면 그 날짜로 캘린더가 이동(포커스)한다. 4개보다 많으면 "전체 일정
 *      보기"로 UpcomingScheduleModal에서 나머지도 볼 수 있다.
 *   3. 캘린더 — AcademicCalendarGrid 기본값이 주간 스트립 1줄이라 여기서는
 *      더 손댈 게 없다(월간 전체보기는 그리드 내부 토글).
 *   4. 학과 공지 — 가로 스크롤 카드 대신 세로 리스트(제목/날짜/구분선).
 *
 * 원문 링크는 새 탭(`target="_blank"`)으로 열되 reverse tabnabbing 방지를 위해
 * `rel="noopener noreferrer"`를 항상 붙인다.
 */
import { useState } from 'react'
import { ChevronDown, ExternalLink, Info, Megaphone } from 'lucide-react'
import { useSchoolDepartments, useSchoolNotices, useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange } from '../../utils/academicCalendar'
import { formatFullDate } from '../../utils/noticeDate'
import AcademicCalendarGrid from './AcademicCalendarGrid'
import UpcomingScheduleModal from './UpcomingScheduleModal'

// "다가오는 학사일정" 리스트에 인라인으로 보여줄 최대 개수. 그보다 많으면
// 나머지는 "전체 일정 보기"로 모달에서 본다.
const UPCOMING_LIST_MAX = 4

// 공지는 useSchoolNotices가 이미 전체(최대 50건)를 한 번에 내려주므로,
// 추가 네트워크 호출 없이 "화면에 몇 개를 보여줄지"만 늘린다.
const NOTICES_INITIAL_COUNT = 5
const NOTICES_STEP = 5

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
  // 캘린더 그리드 + "다가오는 학사일정" 리스트가 공유하는 전체 이벤트(가장
  // 임박한 일정 + 그 다음 일정들) — 표시 개수만 리스트 쪽에서 자른다.
  const allEvents = [next, ...upcoming].filter(Boolean)
  const upcomingList = allEvents.slice(0, UPCOMING_LIST_MAX)
  const hasMoreEvents = allEvents.length > upcomingList.length

  // "전체 일정 보기" 모달(4개보다 많을 때만 필요).
  const [showAllEvents, setShowAllEvents] = useState(false)

  // 리스트 항목을 탭하면 그 날짜로 캘린더를 이동시킨다. AcademicCalendarGrid는
  // 자체 상태(cursor/selectedDate/weekAnchor)를 캡슐화하고 있어 완전한
  // controlled 컴포넌트로 바꾸는 대신, key를 바꿔 그 날짜를 initialDate로 다시
  // 마운트하는 방식으로 "이동"을 구현한다(기존 파일 구조를 크게 건드리지 않음).
  const [focusDate, setFocusDate] = useState(null)
  const calendarInitialDate = focusDate ?? next?.start_date ?? null

  const selectedDeptInfo = departments.find((d) => d.code === selectedDept) ?? null
  const selectedDeptLabel = selectedDeptInfo?.label ?? ''
  // supported 필드가 없는 이전 응답/모킹은 지원 학과로 취급한다(기본값 true).
  const isDeptSupported = selectedDeptInfo?.supported ?? true

  // robots.txt 정책상 아직 지원하지 않는 학과는 API를 아예 호출하지 않는다.
  const { data: noticesData, loading: noticesLoading, error: noticesError } = useSchoolNotices(
    isDeptSupported ? selectedDept : null
  )
  const notices = Array.isArray(noticesData) ? noticesData : []

  // 학과가 바뀌어 공지 목록 자체가 교체되면 보이는 개수도 처음 N개로 되돌린다.
  const [visibleCount, setVisibleCount] = useState(NOTICES_INITIAL_COUNT)
  // 렌더 중 조정 — effect로 미루면 이전 학과의 개수로 한 프레임이 그려진다.
  const [seenDept, setSeenDept] = useState(selectedDept)
  if (selectedDept !== seenDept) {
    setSeenDept(selectedDept)
    setVisibleCount(NOTICES_INITIAL_COUNT)
  }

  const visibleNotices = notices.slice(0, visibleCount)
  const hasMoreNotices = visibleCount < notices.length

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
        <p className="text-body text-mute dark:text-mute text-center py-4">학과 목록을 불러오는 중이에요...</p>
      )}

      {/* 다가오는 학사일정 — 대문. D-day 칩 + 제목 + 기간, 상위 4개.
          탭하면 아래 캘린더가 그 날짜로 이동한다. */}
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

      {/* 캘린더 — 기본은 주간 스트립 1줄(AcademicCalendarGrid 자체 기본값),
          "월 전체보기" 토글은 그리드 내부에 있다. focusDate가 바뀌면 그 날짜로
          다시 마운트해 이동을 반영한다. */}
      {!calLoading && allEvents.length > 0 && (
        <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card px-3 py-3">
          <AcademicCalendarGrid
            key={calendarInitialDate ?? 'none'}
            events={allEvents}
            initialDate={calendarInitialDate}
          />
        </div>
      )}

      {/* 학과 공지 — 세로 리스트(제목/날짜/밑줄 구분). 가로 스크롤이 뷰포트
          밖까지 삐져나가던 문제(결함 #7)를 없앤다. */}
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
          <div className="bg-surface dark:bg-surface border border-line dark:border-line rounded-card divide-y divide-line dark:divide-line overflow-hidden">
            {visibleNotices.map((n) => (
              <a
                key={n.id}
                href={n.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable flex items-start justify-between gap-3 px-4 py-3"
                aria-label={`${n.title} · 원문 보기 (새 탭)`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-label font-bold text-ink dark:text-ink leading-snug line-clamp-2">{n.title}</h3>
                  <p className="text-dest font-semibold text-mute dark:text-mute mt-1">{formatFullDate(n.published_at)}</p>
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
