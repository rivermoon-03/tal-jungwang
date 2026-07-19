/**
 * ShuttleTimetable — 셔틀 시간표 세로 리스트 + 좁은 폰 가로 스트립 컴포넌트.
 *
 * 이 파일의 default export(ShuttleTimetable)는 어디서도 import되지 않는 고아다.
 * 실제로 사용자가 보는 셔틀 시간표는 components/schedule/ScheduleDetailModal.jsx의
 * ShuttleContent다 — 그 컴포넌트는 여기서 만든 BellButton·NarrowPhoneStrip·
 * buildDisplayList·DIRECTION_LABELS를 named export로 가져다 쓴다(알림 종 버튼,
 * 좁은 화면 가로 스크롤 전환). default export와 이 파일 자체는 vitest 스냅샷/회귀
 * 검증용으로 남겨둔다 — 삭제하지 말 것.
 */
import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { useIsNarrowPhone } from '../../hooks/useMediaQuery'
import { useShuttleAlarms } from '../../hooks/useShuttleNotification'
import { scrollToCenter, scrollToCenterX } from '../../utils/scrollToCenter'
import ShuttleNotifySheet from './ShuttleNotifySheet'

// direction 코드(CLAUDE.md 도메인 용어) → 표시 라벨. ScheduleDetailModal의
// ShuttleContent도 알림 시트 문구에 이 매핑을 재사용한다.
export const DIRECTION_LABELS = { 0: '등교', 1: '하교', 2: '제2캠퍼스 등교', 3: '제2캠퍼스 하교' }

function toMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

// note === '수시운행'인 연속 항목을 하나의 밴드로 묶어 display 목록을 생성.
// ScheduleDetailModal의 ShuttleContent도 좁은 폰 스트립을 만들 때 이 함수를
// 그대로 재사용한다(수시운행 밴드 묶기 로직 중복 방지).
export function buildDisplayList(times) {
  const result = []
  let i = 0
  while (i < times.length) {
    if (times[i].note === '수시운행') {
      let j = i
      while (j < times.length && times[j].note === '수시운행') j++
      result.push({
        type: 'frequent',
        key: `frequent-${times[i].depart_at}`,
        startTime: times[i].depart_at,
        endTime: times[j - 1].depart_at,
        startMin: toMinutes(times[i].depart_at),
        endMin: toMinutes(times[j - 1].depart_at),
      })
      i = j
    } else {
      result.push({
        type: 'fixed',
        key: times[i].depart_at,
        time: times[i].depart_at,
        minutes: toMinutes(times[i].depart_at),
        note: times[i].note ?? null,
      })
      i++
    }
  }
  return result
}

function nextLabel(diffMin, isReturn) {
  if (isReturn) return '회차편'
  if (diffMin < 1) return '곧 출발'
  return `${diffMin}분 뒤`
}

// 알림 종 아이콘 버튼 — 예약된 편은 accent 채움(BellRing), 아니면 outline(Bell).
// ScheduleDetailModal의 리스트 뷰(TimeRow)도 이 버튼을 그대로 가져다 쓴다.
export function BellButton({ time, isSet, onOpen, size = 'default' }) {
  const dim = size === 'compact' ? 'w-7 h-7' : 'w-8 h-8'
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(time) }}
      aria-pressed={isSet}
      aria-label={isSet ? `${time} 셔틀 알림 설정됨` : `${time} 셔틀 알림 설정`}
      className={`${dim} shrink-0 rounded-full flex items-center justify-center pressable transition-colors ${
        isSet
          ? 'bg-accent-bg text-accent-ink dark:bg-accent-bg dark:text-accent-ink'
          : 'bg-surface-2 dark:bg-surface-2 text-mute dark:text-mute'
      }`}
    >
      {isSet ? <BellRing size={size === 'compact' ? 14 : 16} /> : <Bell size={size === 'compact' ? 14 : 16} />}
    </button>
  )
}

// ── 좁은 폰(< 360px) 전용 가로 스크롤 스냅 리스트 ──────────────────────────
// 세로 리스트가 좌우 여백 부족으로 시각/뱃지가 잘리는 문제(F4-2)의 대응.
// CSS로 숨기지 않고(mistakes.md §3) 상위에서 useIsNarrowPhone으로 이 컴포넌트
// 자체를 조건부 마운트한다.
// embedded=true면 이 컴포넌트가 이미 스크롤 가능한 부모(ScheduleDetailModal의
// scrollContainerRef) 안에 얹힌다고 가정하고 자체 flex-1/overflow-y-auto/배경/
// 하단 독 여백을 붙이지 않는다 — 겹중첩 스크롤 영역과 배경 이중 도포를 막는다.
export function NarrowPhoneStrip({ displayList, nextIndex, nowMinutes, isAlarmSet, onOpenSheet, embedded = false }) {
  const containerRef = useRef(null)
  const nextRef = useRef(null)

  // 마운트/다음 편 갱신 시 컨테이너 내부만 스크롤(scrollIntoView는 조상까지 밀어
  // 시트 헤더가 잘리는 문제가 있어 사용 금지 — scrollToCenter.js 참고).
  useEffect(() => {
    scrollToCenterX(containerRef.current, nextRef.current)
  }, [nextIndex])

  return (
    <div className={embedded ? '' : 'flex-1 overflow-y-auto bg-surface dark:bg-surface pb-28 md:pb-0'}>
      <div
        ref={containerRef}
        className="flex gap-2 overflow-x-auto snap-x snap-mandatory px-4 py-3"
        style={{ touchAction: 'pan-x' }}
      >
        {displayList.map((item, i) => {
          const isNext = i === nextIndex

          if (item.type === 'frequent') {
            const isActive = nowMinutes >= item.startMin && nowMinutes <= item.endMin
            const isPast = item.endMin < nowMinutes
            return (
              <div
                key={item.key}
                ref={isNext ? nextRef : null}
                className={`snap-center shrink-0 w-[132px] rounded-card border px-2.5 py-2.5 flex flex-col items-center justify-center text-center
                  ${isPast ? 'opacity-40' : ''}
                  ${isActive || isNext ? 'border-accent bg-accent-bg' : 'border-line dark:border-line bg-surface dark:bg-surface'}`}
              >
                <span className={`time-num text-body font-bold ${isActive || isNext ? 'text-accent-ink dark:text-accent-ink' : 'text-ink dark:text-ink'}`}>
                  {item.startTime}–{item.endTime}
                </span>
                <span className="mt-0.5 text-caption font-semibold text-mute dark:text-mute">수시운행</span>
                {(isActive || isNext) && (
                  <span className="mt-1 text-micro font-bold text-accent-ink dark:text-accent-ink">
                    {isActive ? '운행 중' : nextLabel(item.startMin - nowMinutes, false)}
                  </span>
                )}
              </div>
            )
          }

          const isPast = item.minutes < nowMinutes
          const isReturn = item.note?.startsWith('회차편')

          return (
            <div
              key={item.key}
              ref={isNext ? nextRef : null}
              className={`snap-center shrink-0 w-[92px] rounded-card border px-2 py-2.5 flex flex-col items-center justify-center gap-1
                ${isPast ? 'opacity-40' : ''}
                ${isNext ? 'border-accent bg-accent-bg' : 'border-line dark:border-line bg-surface dark:bg-surface'}`}
            >
              <span className={`time-num text-body font-bold ${isNext ? 'text-accent-ink dark:text-accent-ink' : 'text-ink dark:text-ink'}`}>
                {item.time}
              </span>
              {isReturn ? (
                <span className="text-micro font-semibold text-mute dark:text-mute text-center leading-tight">회차편</span>
              ) : item.note ? (
                <span className="text-micro font-semibold text-mute dark:text-mute text-center leading-tight truncate max-w-full">{item.note}</span>
              ) : null}
              {isNext && (
                <span className="text-micro font-bold text-accent-ink dark:text-accent-ink">
                  {nextLabel(item.minutes - nowMinutes, isReturn)}
                </span>
              )}
              <BellButton time={item.time} isSet={isAlarmSet(item.time)} onOpen={onOpenSheet} size="compact" />
            </div>
          )
        })}
      </div>
      <p className="px-4 pb-2 text-caption font-medium text-mute dark:text-mute">
        밀어서 이후 시간 보기
      </p>
    </div>
  )
}

export default function ShuttleTimetable({ times, direction = 0 }) {
  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nextRef = useRef(null)
  const listRef = useRef(null)
  const isNarrowPhone = useIsNarrowPhone()

  // times reference 가 안 바뀌면 displayList 재계산 안 함.
  // (nowMinutes 는 표시 상태 계산용이라 displayList 의존성 아님)
  const displayList = useMemo(() => buildDisplayList(times), [times])

  // 첫 번째 아직 지나지 않은 항목 인덱스
  const nextIndex = displayList.findIndex((item) => {
    if (item.type === 'fixed') return item.minutes > nowMinutes
    return item.endMin > nowMinutes
  })

  useEffect(() => {
    if (isNarrowPhone) return // 좁은 폰은 NarrowPhoneStrip이 자체적으로 가로 스크롤 처리
    scrollToCenter(listRef.current, nextRef.current)
  }, [nextIndex, isNarrowPhone])

  const { addAlarm, isAlarmSet } = useShuttleAlarms()
  const [sheetTime, setSheetTime] = useState(null)

  const openSheet = useCallback((time) => setSheetTime(time), [])
  const closeSheet = useCallback(() => setSheetTime(null), [])
  const handleConfirm = useCallback(
    (lead) => addAlarm(sheetTime, lead, direction),
    [addAlarm, sheetTime, direction]
  )

  const sheet = (
    <ShuttleNotifySheet
      open={sheetTime != null}
      time={sheetTime ?? ''}
      directionLabel={DIRECTION_LABELS[direction] ?? null}
      onClose={closeSheet}
      onConfirm={handleConfirm}
    />
  )

  if (isNarrowPhone) {
    return (
      <>
        <NarrowPhoneStrip
          displayList={displayList}
          nextIndex={nextIndex}
          nowMinutes={nowMinutes}
          isAlarmSet={(time) => isAlarmSet(time, direction)}
          onOpenSheet={openSheet}
        />
        {sheet}
      </>
    )
  }

  return (
    <>
      <ul ref={listRef} className="flex-1 overflow-y-auto bg-surface dark:bg-surface pb-28 md:pb-0">
        {displayList.map((item, i) => {
          const isNext = i === nextIndex

          if (item.type === 'frequent') {
            const isActive = nowMinutes >= item.startMin && nowMinutes <= item.endMin
            const isPast = item.endMin < nowMinutes

            return (
              <li
                key={item.key}
                ref={isNext ? nextRef : null}
                className={`flex items-center justify-between px-5 py-3 border-b border-line dark:border-line
                  ${isPast ? 'opacity-35 pointer-events-none' : ''}
                  ${isActive || isNext ? 'bg-accent-bg dark:bg-accent-bg' : ''}`}
              >
                <div>
                  <span className={`time-num text-lg font-semibold ${isActive || isNext ? 'text-accent-ink dark:text-accent-ink' : 'text-ink dark:text-ink'}`}>
                    {item.startTime} – {item.endTime}
                  </span>
                  <span className="ml-2 text-base text-ink-2 dark:text-mute">수시운행</span>
                </div>
                {(isActive || isNext) && (
                  <span className="text-sm font-bold text-accent-ink dark:text-accent-ink border border-accent dark:border-accent px-2 py-1 rounded">
                    {isActive ? '운행 중' : nextLabel(item.startMin - nowMinutes, false)}
                  </span>
                )}
              </li>
            )
          }

          // type === 'fixed'
          const isPast = item.minutes < nowMinutes
          const isReturn = item.note?.startsWith('회차편')
          const schoolTime = isReturn
            ? (item.note.match(/학교 (\d{2}:\d{2}) 출발/)?.[1] ?? null)
            : null

          return (
            <li
              key={item.key}
              ref={isNext ? nextRef : null}
              className={`flex items-center justify-between gap-2 px-5 py-3 border-b border-line dark:border-line
                ${isPast ? 'opacity-35 pointer-events-none' : ''}
                ${isNext ? 'bg-accent-bg dark:bg-accent-bg' : ''}`}
            >
              {isReturn ? (
                <div className="min-w-0">
                  <p className="text-body text-mute">회차편</p>
                  <p className={`text-body font-medium mt-0.5 leading-snug ${isNext ? 'text-accent-ink dark:text-accent-ink' : 'text-ink-2 dark:text-ink-2-dark'}`}>
                    {schoolTime
                      ? `${schoolTime}에 출발 후 도착하는 버스가 회차하면 탑승하세요`
                      : '수시운행(17:00~18:00) 버스가 회차하면 탑승하세요'}
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <span className={`time-num text-lg font-semibold ${isNext ? 'text-accent-ink dark:text-accent-ink' : 'text-ink dark:text-ink'}`}>
                    {item.time}
                  </span>
                  {item.note && (
                    <span className="ml-2 text-body text-mute">{item.note}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 shrink-0">
                {isNext && (
                  <span className="text-sm font-bold text-accent-ink dark:text-accent-ink border border-accent dark:border-accent px-2 py-1 rounded">
                    {nextLabel(item.minutes - nowMinutes, isReturn)}
                  </span>
                )}
                <BellButton time={item.time} isSet={isAlarmSet(item.time, direction)} onOpen={openSheet} />
              </div>
            </li>
          )
        })}
      </ul>
      {sheet}
    </>
  )
}
