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
import {
  summarizeTodayMenu,
  findExamEvent,
  summarizeLibraryHours,
  roomStateToday,
} from '../../utils/homeBriefing'

const LIBRARY_GUIDE_URL = 'https://library.tukorea.ac.kr/guide/hours'

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

// 열람실 상태 배지 — 지금 열림(accent) / 닫힘 / 오늘 미개방.
const ROOM_STATE_META = {
  open: { label: '열림', cls: 'bg-accent-bg text-accent-ink dark:text-accent-ink' },
  closed: { label: '닫힘', cls: 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute' },
  off: { label: '미개방', cls: 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute' },
}

/**
 * LibraryCard — 도서관 열람실 카드(상시).
 *
 * 원래는 시험 임박(D-7) 때만 뜨는 카드였는데, "지금 어디가 열려 있나"는 시험기간이
 * 아니어도 늘 묻는 질문이라 상시로 올렸다. 시험이 가까우면 D-day 칩이 붙고 카드가
 * 브리핑 위로 올라간다(그때는 이 정보가 화면에서 제일 급한 정보라서).
 */
function LibraryCard({ rooms, summary, exam }) {
  const now = new Date()
  return (
    <div className="px-4 pb-2" aria-label="도서관 열람실 안내">
      <div
        className={`bg-surface dark:bg-surface border rounded-card px-4 py-3 ${
          exam ? 'border-accent/40 dark:border-accent/40' : 'border-line dark:border-line'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {exam && (
            <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-chip-red-bg text-chip-red-fg">
              {exam.title} {formatDday(exam.start_date)}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink dark:text-ink">
            <BookOpen size={14} aria-hidden className="text-mute dark:text-mute" />
            도서관 열람실
          </span>
          {summary && (
            <span className="ml-auto text-caption font-semibold text-mute dark:text-mute">
              {summary.label}
            </span>
          )}
        </div>

        <div className="mt-2 pt-2 border-t border-line dark:border-line space-y-1">
          {rooms.map((r) => {
            const s = roomStateToday(r, now)
            const meta = ROOM_STATE_META[s.state]
            return (
              <p key={r.room} className="flex items-center gap-2 text-caption font-medium text-ink-2 dark:text-ink-2">
                <span className="truncate flex-1 min-w-0">{r.room}</span>
                <span className="font-semibold tabular-nums text-mute dark:text-mute whitespace-nowrap">
                  {s.state === 'off' ? (r.closed ? '미개방' : '오늘 없음') : `${s.startText} ~ ${s.endText}`}
                </span>
                <span className={`text-micro font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${meta.cls}`}>
                  {meta.label}
                </span>
              </p>
            )
          })}
        </div>

        <a
          href={LIBRARY_GUIDE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-caption font-semibold text-accent-ink dark:text-accent-ink pressable"
        >
          도서관 이용안내 열기
        </a>
      </div>
    </div>
  )
}

export default function HomeBriefing() {
  const calendarQuery = useAcademicCalendar()
  const menuQuery = useCafeteriaMenu()
  // 열람실 개관시간은 시험기간에만 쓰기엔 아까운 정보다 — "지금 도서관 열었나"는
  // 평소에도 자주 묻는 질문이라 브리핑 행으로 상시 노출한다.
  const libraryQuery = useLibraryHours()

  const allEvents = [calendarQuery.data?.next, ...(calendarQuery.data?.upcoming ?? [])].filter(Boolean)
  const exam = findExamEvent(allEvents)
  const event = allEvents[0] ?? null
  const menuLine = summarizeTodayMenu(menuQuery.data)
  const rooms = Array.isArray(libraryQuery.data) ? libraryQuery.data : []
  const library = summarizeLibraryHours(rooms)

  if (!event && !menuLine && !exam && !library) return null

  // 시험이 가까우면 열람실 카드가 브리핑보다 급하다 — 그때만 위로 올린다.
  const libraryCard = library ? (
    <LibraryCard rooms={rooms} summary={library} exam={exam} />
  ) : null

  return (
    <div className="pb-6" aria-label="오늘 브리핑 영역">
      {exam && libraryCard}
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
      {!exam && libraryCard}
    </div>
  )
}
