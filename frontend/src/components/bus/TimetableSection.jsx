import { useEffect, useMemo, useRef, useState } from 'react'
import SegmentedControl from '../ui/SegmentedControl'
import NowAnchorLine from '../schedule/NowAnchorLine'
import { anchorLabel, findAnchorSplit, insertAnchorLine } from '../schedule/timetableGroups'
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
 *   defaultExpanded boolean  초기 펼침 상태. 실시간 출처가 없는 방면(시간표만
 *                    있는 방면)은 혼잡도·과거 기록으로 대신 볼 정보가 없으니
 *                    이 시간표가 그 방면의 유일한 운행 정보다 — true로 넘겨
 *                    처음부터 펼쳐서 보여준다. 실시간 출처가 있는 방면은 기존
 *                    그대로 접힌 채 시작(false, 기본값).
 */
export default function TimetableSection({
  timetable,
  dayTab,
  onDayTabChange,
  nowMin,
  originStopName,
  onJumpToHistory,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // "지금"에 가장 가까운 다음 차 칩 — 펼침 뷰가 열릴 때 그 위치로 스크롤한다.
  const nextRef = useRef(null)

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

  // 펼침 뷰가 열릴 때 "지금"에 가장 가까운 다음 차로 스크롤한다 — 검증된 구현은
  // BusTimetableDetail.jsx(도달 불가 상태)에 이미 있었다("3시쯤 뭐 있지"를 처음부터
  // 순차로 읽지 않도록). 새로 짜지 않고 그 scrollIntoView 패턴을 그대로 옮긴다.
  // 훅은 조건 없이 최상단에서 호출해야 하므로 이른 return(아래)보다 앞에 둔다.
  useEffect(() => {
    if (!expanded) return
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [expanded, nextIdx])

  // 이 노선은 시간표 자체가 없다(모든 요일 빈 배열) — 섹션을 통째로 숨긴다.
  if (availableDays.length === 0 || !summary) return null

  const hourGroups = groupTimesByHour(times)

  // "지금 HH:MM · 다음 N분" 앵커 — 셔틀/지하철 상세와 같은 문구·라운딩을 쓰도록
  // schedule/timetableGroups.js(eta.js에 위임)를 그대로 재사용한다. nowMin은
  // 정수 분이라 seconds는 0으로 둔다 — anchorLabel은 어차피 시·분만 읽는다.
  const nextEntry = nextIdx >= 0 ? entries[nextIdx] : null
  const nowDate = new Date()
  nowDate.setHours(Math.floor(nowMin / 60), nowMin % 60, 0, 0)
  const nowLabel = anchorLabel(nowDate, nextEntry?.depart_at ?? null)

  // 다음 차가 시(hour) 그룹 중간에 있으면 그룹 헤더 앞이 아니라 그룹 안에서
  // 갈라 넣어야 한다(결함 4와 동일한 문제 — 셔틀/지하철 상세와 규칙을 맞춘다).
  const anchorGroups = hourGroups.map((group) => ({
    items: group.times.map((t) => ({ key: t })),
  }))
  const anchorSplit = findAnchorSplit(anchorGroups, nextEntry?.depart_at ?? null)

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

      {/* 심야처럼 운행이 통째로 끊기는 구간은 배차 계산에서 뺐다(위 3타일에는
          안 섞임) — 그 사실 자체를 숨기지 않고 별도 문구로 알려준다. */}
      {summary.overnightGaps.length > 0 && (
        <p className="text-caption text-mute dark:text-mute mb-3">
          {summary.overnightGaps.map((g) => `${g.from}~${g.to} 운행 공백`).join(', ')}
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[44px] items-center text-caption font-semibold text-accent-ink dark:text-accent pressable"
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
            {hourGroups.map((group, groupIndex) => {
              // 시(hour) 그룹 전체가 이미 지난 시간대면 헤더까지 흐리게 — 눈이
              // "지금" 쪽 그룹으로 먼저 가게 한다.
              const groupIsPast = group.times.every((t) => toMinutes(t) < nowMin)
              const isAnchorGroup = anchorSplit?.groupIndex === groupIndex
              const anchorAfterIndex = isAnchorGroup ? anchorSplit.insideAfterIndex : null
              return (
                <div key={group.hour} className="flex flex-col gap-1.5">
                  {isAnchorGroup && anchorAfterIndex === null && <NowAnchorLine label={nowLabel} />}
                  <div className={groupIsPast ? 'opacity-50' : undefined}>
                    <span className="block text-caption font-bold text-mute dark:text-mute mb-1.5">
                      {group.hour}시
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {insertAnchorLine(
                        group.times.map((t) => ({ key: t })),
                        anchorAfterIndex,
                        nowLabel,
                        (item, i) => {
                          const t = item.key
                          const globalIdx = entries.findIndex((e) => e.depart_at === t)
                          const isPast = toMinutes(t) < nowMin
                          const isNext = globalIdx === nextIdx
                          return (
                            <span
                              key={`${t}-${i}`}
                              ref={isNext ? nextRef : null}
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
                        }
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {onJumpToHistory && (
        <button
          type="button"
          onClick={onJumpToHistory}
          className="flex min-h-[44px] items-center text-caption font-semibold text-mute dark:text-mute underline underline-offset-2 pressable"
        >
          과거 도착 기록 보기
        </button>
      )}
    </section>
  )
}
