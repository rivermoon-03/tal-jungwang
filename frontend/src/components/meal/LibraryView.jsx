import { BookOpen, ExternalLink, RefreshCw } from 'lucide-react'
import { useAcademicCalendar, useLibraryHours } from '../../hooks/useMore'
import { findExamEvent, roomStateToday, summarizeLibraryHours } from '../../utils/homeBriefing'
import { formatDday } from '../../utils/academicCalendar'
import { Banner, Card, Pill, SectionLabel, Skeleton } from '../kit/bits'

const GUIDE_URL = 'https://library.tukorea.ac.kr/guide/hours'

function hoursText(room, s) {
  if (s.state === 'off') return room.closed ? '' : '오늘 운영 안 해요'
  if (s.always) return '24시간'
  return `${s.startText} ~ ${s.endText}`
}

/** 도서관 열람실. 시험이 가까우면 D-day 를 맨 위에 둔다. */
export default function LibraryView() {
  const { data, loading, refetch } = useLibraryHours()
  const { data: cal } = useAcademicCalendar()
  const rooms = Array.isArray(data) ? data : []
  const summary = summarizeLibraryHours(rooms)
  const exam = findExamEvent([cal?.next, ...(cal?.upcoming ?? [])].filter(Boolean))
  const now = new Date()

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-3">
      {exam && (
        <div className="mb-1">
          <Banner kind="warn" title={`${exam.title} ${formatDday(exam.start_date)}`} />
        </div>
      )}
      <SectionLabel Icon={BookOpen} trailing={summary && <span className="text-f14 font-bold text-ink-2">{summary.label}</span>}>
        열람실
      </SectionLabel>

      {loading && rooms.length === 0 && <Skeleton className="h-48 rounded-[20px]" />}
      {!loading && rooms.length === 0 && (
        <Card className="p-4">
          <p className="text-f16 font-extrabold text-ink">열람실 정보를 불러오지 못했어요</p>
          <button type="button" onClick={refetch} className="mt-3 flex h-10 items-center gap-1.5 rounded-xl border border-line px-3.5 text-f14 font-extrabold text-ink">
            <RefreshCw size={15} aria-hidden="true" />
            다시 시도
          </button>
        </Card>
      )}
      {rooms.length > 0 && (
        <Card as="ul" className="divide-y divide-line-soft">
          {rooms.map((r) => {
            const s = roomStateToday(r, now)
            const open = s.state === 'open'
            return (
              <li key={r.room} className="flex items-center gap-3 px-4 py-3.5">
                <p className="min-w-0 flex-1 truncate text-f16 font-extrabold text-ink">{r.room}</p>
                <span className={`whitespace-nowrap text-f15 font-bold tabular-nums ${s.state === 'off' ? 'text-mute' : 'text-ink'}`}>{hoursText(r, s)}</span>
                <Pill kind={open ? 'open' : 'closed'}>{open ? '열림' : s.state === 'off' ? '미개방' : '닫힘'}</Pill>
              </li>
            )
          })}
        </Card>
      )}
      <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 px-1 text-f14 font-extrabold text-accent-ink">
        <ExternalLink size={14} aria-hidden="true" />
        도서관 이용안내
      </a>
    </div>
  )
}
