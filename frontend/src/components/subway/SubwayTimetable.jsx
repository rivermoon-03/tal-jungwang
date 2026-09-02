/**
 * SubwayTimetable — 지하철 상세 시(hour) 그룹 시간표(시안 "시간표 화면").
 *
 * 실제 화면에서는 subway/GlobalSubwayDetailSheet.jsx가 자체 그리드(toGridItems)를
 * 그리므로 이 파일의 default export는 현재 어디서도 import되지 않는 고아다
 * (shuttle/ShuttleTimetable.jsx와 같은 규약 — vitest 회귀 검증용으로 남겨둔다.
 * 삭제하지 말 것). entries/nextIndex/lastIdx는 호출부가 이미 계산해 넘겨준다는
 * 계약을 유지하고, 렌더는 공용 HourGroupTimetable(schedule/)로 통일해 시(hour)
 * 그룹 + "지금" 앵커 규격을 맞춘다.
 *
 * 자동 스크롤은 BusTimetableDetail.jsx의 검증된 scrollIntoView 패턴을 그대로
 * 옮긴다 — 이 컴포넌트는 (ScheduleDetailModal의 DirectionBlock과 달리) 자신을
 * 감싸는 스크롤 컨테이너 ref를 넘겨받지 않는 독립 화면이라 scrollToCenter 대신
 * scrollIntoView를 쓴다(모달 조상 스크롤을 밀어 헤더를 잘라먹는 문제는 독립
 * 화면에는 해당하지 않는다).
 */
import { useEffect, useRef } from 'react'
import HourGroupTimetable from '../schedule/HourGroupTimetable'
import { useNow } from '../../hooks/useNow'

export default function SubwayTimetable({ entries, nextIndex, lastIdx }) {
  const nowMs = useNow(60_000)
  const now = new Date(nowMs)
  const nextRef = useRef(null)

  const items = entries.map((train, i) => ({
    key: `${train.depart_at}-${i}`,
    time: train.depart_at,
    sub: `${train.destination}행`,
    isPast: nextIndex === -1 ? true : i < nextIndex,
    isNext: i === nextIndex,
    isLast: i === lastIdx,
  }))

  useEffect(() => {
    nextRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [nextIndex])

  return (
    <div className="flex-1 overflow-y-auto bg-surface dark:bg-bg px-4 py-3 pb-16 md:pb-0">
      <HourGroupTimetable items={items} now={now} nextRef={nextRef} />
    </div>
  )
}
