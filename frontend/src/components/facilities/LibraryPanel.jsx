/**
 * LibraryPanel — 도서관 열람실 개관시간(F7).
 *
 * 홈 브리핑과 학교시설 탭이 같은 카드를 쓴다. 예전에는 홈에만 있었는데, 도착
 * 카드·학사일정·학식 아래에 쌓여 스크롤 끝까지 가야 보였다. 상시 자리는
 * 학교시설 탭이 갖고, 홈에는 시험이 임박했을 때만 남긴다 — 그때는 이 정보가
 * 화면에서 제일 급하다.
 *
 * Props:
 *   rooms    열람실 배열(/school/library-hours)
 *   summary  summarizeLibraryHours 결과(없으면 우측 요약 생략)
 *   exam     임박한 시험 일정(있으면 D-day 칩 + 강조 보더)
 *   compact  홈에서 쓰는 축약형(가로 패딩을 호출부가 갖는다)
 */
import { BookOpen } from 'lucide-react'
import { formatDday } from '../../utils/academicCalendar'
import { roomStateToday } from '../../utils/homeBriefing'

export const LIBRARY_GUIDE_URL = 'https://library.tukorea.ac.kr/guide/hours'

// 열람실 상태 배지 — 지금 열림(accent) / 닫힘 / 오늘 미개방.
const ROOM_STATE_META = {
  open: { label: '열림', cls: 'bg-accent-bg text-accent-ink dark:text-accent-ink' },
  closed: { label: '닫힘', cls: 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute' },
  off: { label: '미개방', cls: 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute' },
}

export default function LibraryPanel({ rooms = [], summary = null, exam = null }) {
  const now = new Date()
  return (
    <div
      className={`bg-surface dark:bg-surface border rounded-card px-4 py-3 ${
        exam ? 'border-accent/40 dark:border-accent/40' : 'border-line dark:border-line'
      }`}
      aria-label="도서관 열람실 안내"
    >
      <div className="flex items-center gap-2 flex-wrap">
        {exam && (
          <span className="text-caption font-bold px-2 py-0.5 rounded-full bg-chip-red-bg text-chip-red-fg">
            {exam.title} {formatDday(exam.start_date)}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-mini-ttl font-bold text-ink dark:text-ink">
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
  )
}
