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
import { useAcademicCalendar } from '../../hooks/useMore'
import { useCafeteriaMenu } from '../../hooks/useCafeteria'
import { formatDday } from '../../utils/academicCalendar'
import { summarizeTodayMenu } from '../../utils/homeBriefing'

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

  const event = calendarQuery.data?.next ?? calendarQuery.data?.upcoming?.[0] ?? null
  const menuLine = summarizeTodayMenu(menuQuery.data)

  if (!event && !menuLine) return null

  return (
    <div className="px-4 pb-6 space-y-2" aria-label="오늘 브리핑">
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
  )
}
