import HourGroupBlock from './HourGroupBlock'
import NowAnchorLine from './NowAnchorLine'
import { groupItemsByHour, anchorLabel, findAnchorSplit } from './timetableGroups'

/**
 * HourGroupTimetable — 지하철 상세(ScheduleDetailModal의 DirectionBlock,
 * subway/SubwayTimetable.jsx)용 시(hour) 그룹 시간표.
 *
 * items(하루 전체 — 과거+미래)를 시 단위로 묶고, "지나간 차"와 "다음 차"
 * 사이에 "지금" 앵커를 끼워 넣는다. "다음" 항목이 그룹의 첫 항목이 아니면
 * 그룹 중간에서 갈라 넣어야 한다(결함 4) — 그룹 전체 뒤에 무조건 넣으면
 * 다음 항목이 앵커보다 위에 그려져 이미 지나간 차처럼 보인다. 자동 스크롤
 * 자체는 호출부가 scrollContainerRef/scrollIntoView로 처리한다 — 이
 * 컴포넌트는 nextRef를 "다음" 칩에 붙여주기만 한다.
 *
 * @param {Array<{key,time,isPast,isNext,isLast,sub?}>} items
 * @param {Date} now
 * @param {React.RefObject} nextRef
 */
export default function HourGroupTimetable({ items, now, nextRef }) {
  const groups = groupItemsByHour(items)
  const nextItem = items.find((it) => it.isNext)
  const label = anchorLabel(now, nextItem?.time ?? null)
  const split = findAnchorSplit(groups, nextItem?.key ?? null)

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, groupIndex) => {
        const isAnchorGroup = split?.groupIndex === groupIndex
        return (
          <div key={group.hour} className="flex flex-col gap-3">
            {isAnchorGroup && split.insideAfterIndex === null && <NowAnchorLine label={label} />}
            <HourGroupBlock
              hour={group.hour}
              items={group.items}
              hasLast={group.items.some((it) => it.isLast)}
              nextRef={nextRef}
              anchorAfterIndex={isAnchorGroup ? split.insideAfterIndex : null}
              anchorLabel={label}
            />
          </div>
        )
      })}
    </div>
  )
}
