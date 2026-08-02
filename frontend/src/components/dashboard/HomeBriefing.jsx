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
import { CalendarDays, UtensilsCrossed, ChevronRight, BookOpen } from 'lucide-react'
import { useAcademicCalendar, useLibraryHours } from '../../hooks/useMore'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { formatDday } from '../../utils/academicCalendar'
import { summarizeTodayMenu, findExamEvent } from '../../utils/homeBriefing'

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

// F7 — 시험기간 카드. 학사일정에 시험(중간·기말고사)이 임박(7일)·진행 중일 때만
// 브리핑 위에 승격된다. 도서관 개관시간은 시험 카드가 뜰 때만 조회한다(enabled).
function ExamCard({ exam }) {
  const hoursQuery = useLibraryHours({ enabled: !!exam })
  const rooms = (Array.isArray(hoursQuery.data) ? hoursQuery.data : []).slice(0, 3)

  return (
    <div className="px-4 pb-2" aria-label="시험기간 안내">
      <div className="bg-surface dark:bg-surface border border-accent/40 dark:border-accent/40 rounded-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-chip-red-bg text-chip-red-fg">
            {exam.title} {formatDday(exam.start_date)}
          </span>
          <span className="text-caption font-semibold text-mute dark:text-mute ml-auto tabular-nums">
            {exam.start_date?.slice(5).replace('-', '/')}~{(exam.end_date ?? exam.start_date)?.slice(5).replace('-', '/')}
          </span>
        </div>
        {rooms.length > 0 && (
          <div className="mt-2 pt-2 border-t border-line dark:border-line space-y-1">
            {rooms.map((r) => (
              <p key={r.room} className="flex items-center gap-1.5 text-caption font-medium text-ink-2 dark:text-ink-2">
                <BookOpen size={13} aria-hidden className="text-mute dark:text-mute flex-shrink-0" />
                <span className="truncate">{r.room}</span>
                <span className={`ml-auto font-bold tabular-nums ${r.closed ? 'text-mute dark:text-mute' : ''}`}>
                  {r.hours}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function HomeBriefing() {
  const calendarQuery = useAcademicCalendar()
  const menuQuery = useCafeteriaMenu()

  const allEvents = [calendarQuery.data?.next, ...(calendarQuery.data?.upcoming ?? [])].filter(Boolean)
  const exam = findExamEvent(allEvents)
  const event = allEvents[0] ?? null
  const menuLine = summarizeTodayMenu(menuQuery.data)

  if (!event && !menuLine && !exam) return null

  return (
    <div className="pb-6" aria-label="오늘 브리핑 영역">
      {exam && <ExamCard exam={exam} />}
      <div className="px-4 space-y-2" aria-label="오늘 브리핑">
      <h3 className="text-[13px] font-bold text-ink dark:text-ink px-0.5">오늘 브리핑</h3>
      {event && (
        <BriefingRow
          icon={<CalendarDays size={15} aria-hidden />}
          label={`학사일정 ${formatDday(event.start_date)}`}
          value={event.title}
          ariaLabel={`학사일정 ${event.title} · 더보기에서 보기`}
          onClick={() => goTo('/more')}
        />
      )}
      {menuLine && (
        <BriefingRow
          icon={<UtensilsCrossed size={15} aria-hidden />}
          label="오늘의 학식"
          value={menuLine}
          ariaLabel="오늘의 학식 · 학식 탭에서 보기"
          onClick={() => goTo('/cafeteria')}
        />
      )}
      </div>
    </div>
  )
}
