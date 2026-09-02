/**
 * HomeBriefing — 홈 하단 브리핑(F1).
 *
 * 도착 카드 2~3장 아래로 화면 절반이 비던 자리에, 이미 보유한 데이터만 재배치해
 * "매일 아침 여는 이유"를 더한다: 다가오는 학사일정 D-day + 오늘의 학식 한 줄.
 * 신규 수집·폴링 없음 — useAcademicCalendar/useCafeteriaMenu는 더보기·학식 탭과
 * 같은 path라 useApi 캐시에서 dedup된다.
 *
 * 보여줄 것이 하나도 없으면(방학 주말 등) 섹션 자체를 그리지 않는다 —
 * 빈 껍데기 카드가 여백보다 나쁘다.
 */
import { CalendarDays, UtensilsCrossed, ChevronRight } from 'lucide-react'
import { useAcademicCalendar, useLibraryHours } from '../../hooks/useMore'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { formatDday } from '../../utils/academicCalendar'
import {
  summarizeTodayMenu,
  findExamEvent,
  summarizeLibraryHours,
} from '../../utils/homeBriefing'
import LibraryPanel from '../facilities/LibraryPanel'

// pathname 페이지 이동 — 라우터 없이 pushState + popstate 디스패치(MorePage
// 개인정보처리방침 진입과 동일한 관례).
function goTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function BriefingRow({ icon, label, value, onClick, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-full flex items-center gap-3 px-4 py-3 bg-surface dark:bg-surface border border-line dark:border-line rounded-card pressable text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tj-focus-ring)]"
    >
      <span className="w-8 h-8 rounded-full bg-accent-bg dark:bg-accent-bg text-accent-ink dark:text-accent-ink flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-caption font-semibold text-mute dark:text-mute">{label}</span>
        <span className="block text-label font-bold text-ink dark:text-ink truncate">{value}</span>
      </span>
      <ChevronRight size={16} aria-hidden className="text-mute dark:text-mute flex-shrink-0" />
    </button>
  )
}

export default function HomeBriefing() {
  const calendarQuery = useAcademicCalendar()
  const menuQuery = useCafeteriaMenu()
  // 평소의 "지금 도서관 열었나"는 학교시설 탭이 상시로 답한다. 홈에서는 시험이
  // 임박했을 때만 꺼낸다 — 그 외에는 교통 정보가 화면을 온전히 쓰는 편이 낫다.
  const libraryQuery = useLibraryHours()

  const allEvents = [calendarQuery.data?.next, ...(calendarQuery.data?.upcoming ?? [])].filter(Boolean)
  const exam = findExamEvent(allEvents)
  const event = allEvents[0] ?? null
  const menuLine = summarizeTodayMenu(menuQuery.data)
  const rooms = Array.isArray(libraryQuery.data) ? libraryQuery.data : []
  const library = summarizeLibraryHours(rooms)

  if (!event && !menuLine && !exam) return null

  // 시험이 가까울 때만 열람실 카드를 홈에 올린다(그때는 화면에서 제일 급한 정보).
  const libraryCard = exam && library ? (
    <div className="px-4 pb-2">
      <LibraryPanel rooms={rooms} summary={library} exam={exam} />
    </div>
  ) : null

  return (
    <div className="pb-6" aria-label="오늘 브리핑 영역">
      {libraryCard}
      <div className="px-4 space-y-2" aria-label="오늘 브리핑">
      <h3 className="text-mini-ttl font-bold text-ink dark:text-ink px-0.5">오늘 브리핑</h3>
      {event && (
        <BriefingRow
          icon={<CalendarDays size={15} aria-hidden />}
          label={`학사일정 ${formatDday(event.start_date)}`}
          value={event.title}
          ariaLabel={`학사일정 ${event.title} · 공지 탭에서 보기`}
          onClick={() => goTo('/notices')}
        />
      )}
      {menuLine && (
        <BriefingRow
          icon={<UtensilsCrossed size={15} aria-hidden />}
          label="오늘의 학식"
          value={menuLine}
          ariaLabel="오늘의 학식 · 학교시설 탭에서 보기"
          onClick={() => goTo('/facilities')}
        />
      )}
      </div>
    </div>
  )
}
