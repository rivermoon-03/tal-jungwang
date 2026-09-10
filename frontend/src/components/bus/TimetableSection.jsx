import { useMemo } from 'react'
import SegmentedControl from '../ui/SegmentedControl'
import HourGroupTimetable from '../schedule/HourGroupTimetable'
import TimeGridView from '../schedule/TimeGridView'
import TimetableStatTiles from '../schedule/TimetableStatTiles'
import useAppStore from '../../stores/useAppStore'
import { computeTimetableSummary } from './timetableStats'

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
 * TimetableSection — 노선 상세 페이지 ② 시간표 섹션.
 *
 * 출발 시각 목록은 시간표 탭(schedule/ScheduleDetailModal의 BusContent)과 같은
 * 컴포넌트로 그린다 — 같은 노선의 같은 시간표가 진입 경로에 따라 다른 모양으로
 * 보이면 안 된다. 리스트/그리드 선택도 그 탭과 같은 persist 값(scheduleViewMode)을
 * 읽는다.
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
  const viewMode = useAppStore((s) => s.scheduleViewMode)

  const availableDays = useMemo(() => {
    if (!timetable) return []
    return DAY_ORDER.filter((d) => (timetable[d]?.length ?? 0) > 0)
  }, [timetable])

  const entries = useMemo(() => timetable?.[dayTab] ?? [], [timetable, dayTab])
  const times = useMemo(() => entries.map((e) => e.depart_at).filter(Boolean), [entries])
  const summary = useMemo(() => computeTimetableSummary(times), [times])
  const nextIdx = useMemo(
    () => entries.findIndex((e) => toMinutes(e.depart_at) >= nowMin),
    [entries, nowMin]
  )
  // 남은 횟수 — nextIdx부터 끝까지. 오늘 운행이 끝났으면(nextIdx === -1) 0.
  const remainingCount = nextIdx === -1 ? 0 : entries.length - nextIdx

  // HourGroupTimetable/TimeGridView가 받는 item 규격. 여기서 지난 차·다음 차·막차
  // 판정을 끝내고 넘긴다(두 뷰가 같은 판정을 다시 하지 않는다).
  const items = useMemo(
    () =>
      entries.map((e, i) => ({
        key: `${e.depart_at}-${i}`,
        time: e.depart_at,
        isPast: toMinutes(e.depart_at) < nowMin,
        isNext: i === nextIdx,
        isLast: i === entries.length - 1,
      })),
    [entries, nextIdx, nowMin]
  )

  // 이 노선은 시간표 자체가 없다(모든 요일 빈 배열) — 섹션을 통째로 숨긴다.
  if (availableDays.length === 0 || !summary) return null

  // "지금 HH:MM · 다음 N분" 앵커 문구는 HourGroupTimetable이 Date로 계산한다.
  // nowMin은 정수 분이라 초는 0으로 둔다 — 어차피 시·분만 읽는다.
  const nowDate = new Date()
  nowDate.setHours(Math.floor(nowMin / 60), nowMin % 60, 0, 0)

  // 요약 한 줄 — 셔틀 상세(ShuttleContent)와 같은 형태로 통일한다:
  // "{요일} 시간표 · 총 N회 · 남은 M회 · OO 승차". originStopName이 없는
  // 노선(응답에 기점 정류장명이 없는 경우)은 마지막 구절을 아예 붙이지 않는다.
  const summaryLine =
    `${DAY_LABELS[dayTab] ?? dayTab} 시간표 · 총 ${summary.count}회 · 남은 ${remainingCount}회` +
    (originStopName ? ` · ${originStopName} 승차` : '')

  return (
    <section aria-label="시간표">
      <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em] mb-2.5">
        시간표
      </h2>

      {/* ① 요일 칩 — 셔틀 상세의 기간 칩과 같은 자리(맨 앞)에 둔다. */}
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

      {/* ② 요약 한 줄 */}
      <p className="text-caption font-semibold text-mute dark:text-mute mb-3">{summaryLine}</p>

      {/* ③ 요약 3타일(첫차/막차/배차) — 심야 공백 안내까지 셔틀과 공유하는
          schedule/TimetableStatTiles가 그린다(계산은 이미 위 summary가 끝냄). */}
      <TimetableStatTiles summary={summary} />

      {/* ④ 출발 시각 — 시간표 탭과 같은 컴포넌트. originStopName은 위 ② 요약
          한 줄에 이미 "OO 승차"로 나오므로 여기서 다시 반복하지 않는다. */}
      {viewMode === 'grid' ? (
        <TimeGridView items={items} />
      ) : (
        <HourGroupTimetable items={items} now={nowDate} />
      )}

      {onJumpToHistory && (
        <button
          type="button"
          onClick={onJumpToHistory}
          className="mt-2 flex min-h-[44px] items-center text-caption font-semibold text-mute dark:text-mute underline underline-offset-2 pressable"
        >
          과거 도착 기록 보기
        </button>
      )}
    </section>
  )
}
