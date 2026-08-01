import { useMemo, useState } from 'react'
import SegmentedControl from '../ui/SegmentedControl'
import { computeTimetableSummary, groupTimesByHour, intervalLabel } from './timetableStats'

// sunday 라벨은 '일/공휴일' — RouteDetailPage의 기존 관례를 그대로 따른다
// (app/core/calendar.py가 공휴일도 'sunday'로 매핑하기 때문).
const DAY_LABELS = { weekday: '평일', saturday: '토요일', sunday: '일/공휴일' }
const DAY_ORDER = ['weekday', 'saturday', 'sunday']

// "HH:MM" → 하루 중 분
function toMinutes(hhmm) {
  if (typeof hhmm !== 'string') return Infinity
  const [hh, mm] = hhmm.split(':').map(Number)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return Infinity
  return hh * 60 + mm
}

/**
 * TimetableSection — 노선 상세 페이지 ② 시간표 섹션(신설).
 *
 * timetable 데이터가 있는 요일(day_type)만 칩으로 노출한다 — 시간표가 아예
 * 없는 노선(모든 요일이 빈 배열)이면 섹션 전체를 숨긴다(빈 섹션 금지).
 *
 * Props:
 *   timetable      { weekday: entry[], saturday: entry[], sunday: entry[] }
 *                  entry: { depart_at, note?, is_last? }
 *   dayTab         string  현재 선택된 day_type
 *   onDayTabChange (id) => void
 *   nowMin         number  오늘 자정 기준 현재 분(다음 차 강조/지난 차 판정용)
 *   originStopName string|null
 *   onJumpToHistory () => void | null  하단 "도착 기록 보기" 링크(⑤로 스크롤).
 *                    null이면 링크 자체를 렌더하지 않는다(실시간 도착 이력이
 *                    없는 노선 — 결함 #30, 링크는 한 곳에만 존재해야 한다).
 */
export default function TimetableSection({
  timetable,
  dayTab,
  onDayTabChange,
  nowMin,
  originStopName,
  onJumpToHistory,
}) {
  const [expanded, setExpanded] = useState(false)

  const availableDays = useMemo(() => {
    if (!timetable) return []
    return DAY_ORDER.filter((d) => (timetable[d]?.length ?? 0) > 0)
  }, [timetable])

  const entries = useMemo(() => timetable?.[dayTab] ?? [], [timetable, dayTab])
  const times = useMemo(() => entries.map((e) => e.depart_at).filter(Boolean), [entries])
  const summary = useMemo(() => computeTimetableSummary(times), [times])

  // 이 노선은 시간표 자체가 없다(모든 요일 빈 배열) — 섹션을 통째로 숨긴다.
  if (availableDays.length === 0 || !summary) return null

  const nextIdx = entries.findIndex((e) => toMinutes(e.depart_at) >= nowMin)
  const hourGroups = groupTimesByHour(times)

  return (
    <section aria-label="시간표">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em]">
          시간표
        </h2>
        <span className="text-caption font-semibold text-mute dark:text-mute shrink-0 pt-0.5">
          {DAY_LABELS[dayTab] ?? dayTab} · {summary.count}회 운행
        </span>
      </div>

      {availableDays.length > 1 && (
        <div className="mb-3">
          <SegmentedControl
            size="sm"
            ariaLabel="요일 선택"
            options={availableDays.map((d) => ({ value: d, label: DAY_LABELS[d] ?? d }))}
            value={dayTab}
            onChange={onDayTabChange}
          />
        </div>
      )}

      {/* 요약 3타일 — 첫차 / 막차 / 배차 */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-button bg-surface-2 dark:bg-bg border border-line dark:border-line px-3 py-2.5 text-center">
          <span className="block text-caption font-semibold text-mute dark:text-mute mb-0.5">첫차</span>
          <span className="block text-body font-bold text-ink dark:text-ink tabular-nums">{summary.firstBus}</span>
        </div>
        <div className="rounded-button bg-surface-2 dark:bg-bg border border-line dark:border-line px-3 py-2.5 text-center">
          <span className="block text-caption font-semibold text-mute dark:text-mute mb-0.5">막차</span>
          <span className="block text-body font-bold text-ink dark:text-ink tabular-nums">{summary.lastBus}</span>
        </div>
        <div className="rounded-button bg-surface-2 dark:bg-bg border border-line dark:border-line px-3 py-2.5 text-center">
          <span className="block text-caption font-semibold text-mute dark:text-mute mb-0.5">배차</span>
          <span className="block text-body font-bold text-ink dark:text-ink tabular-nums">
            {intervalLabel(summary.interval) ?? '정보 없음'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-caption font-semibold text-accent-ink dark:text-accent pressable"
      >
        {expanded ? '전체 시간표 접기' : '전체 시간표 보기'}
      </button>

      {expanded && (
        <div className="mt-3 rounded-sheet bg-surface dark:bg-surface border border-line dark:border-line overflow-hidden">
          {originStopName && (
            <p className="px-4 pt-3 text-caption font-semibold text-mute dark:text-mute">
              {originStopName} 출발 시각
            </p>
          )}
          <div className="p-3 flex flex-col gap-3">
            {hourGroups.map((group) => (
              <div key={group.hour}>
                <span className="block text-caption font-bold text-mute dark:text-mute mb-1.5">
                  {group.hour}시
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {group.times.map((t, i) => {
                    const globalIdx = entries.findIndex((e) => e.depart_at === t)
                    const isPast = toMinutes(t) < nowMin
                    const isNext = globalIdx === nextIdx
                    return (
                      <span
                        key={`${t}-${i}`}
                        className={[
                          'inline-flex items-center rounded-button px-2.5 py-1.5 text-caption font-bold tabular-nums',
                          isNext
                            ? 'bg-accent-bg text-accent-ink dark:text-accent'
                            : isPast
                              ? 'text-ink-2 dark:text-ink-2-dark'
                              : 'text-ink dark:text-ink',
                        ].join(' ')}
                      >
                        {t}
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {onJumpToHistory && (
        <button
          type="button"
          onClick={onJumpToHistory}
          className="mt-3 text-caption font-semibold text-mute dark:text-mute underline underline-offset-2 pressable"
        >
          과거 도착 기록 보기
        </button>
      )}
    </section>
  )
}
