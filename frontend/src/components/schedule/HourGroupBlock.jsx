import TimeChip from './TimeChip'
import { insertAnchorLine } from './timetableGroups'

/**
 * HourGroupBlock — "20시 3편" / "22시 2편 · 막차" 형태의 시(hour) 헤더 + 시각 칩
 * 그리드 한 덩어리. 지하철 상세(HourGroupTimetable)와 셔틀 상세
 * (shuttle/ShuttleTimetableGroups)가 같은 헤더 규격을 쓰도록 공유한다.
 *
 * 헤더 규격(시안): 시(hour) 라벨 14px(text-body-sm, weight는 font-extrabold로
 * 직접 지정) + 편수 라벨 12px(text-meta, weight는 font-bold로 직접 지정) mute.
 *
 * anchorAfterIndex/anchorLabel: "다음" 항목이 이 그룹 중간에 있을 때(결함 4)
 * 시 헤더를 중복하지 않고 칩 행 안에서만 "지금" 앵커를 갈라 넣기 위한 값.
 * 호출부(HourGroupTimetable)가 timetableGroups.findAnchorSplit으로 계산해 넘긴다.
 */
export default function HourGroupBlock({ hour, items, hasLast, nextRef, anchorAfterIndex = null, anchorLabel = null }) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5 mb-1.5">
        <span className="text-body-sm font-extrabold text-ink dark:text-ink tabular-nums">{hour}시</span>
        <span className="text-meta font-bold text-mute dark:text-mute">
          {items.length}편{hasLast ? ' · 막차' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {insertAnchorLine(items, anchorAfterIndex, anchorLabel, (it) => (
          <TimeChip
            key={it.key}
            time={it.time}
            sub={it.sub}
            isPast={it.isPast}
            isNext={it.isNext}
            chipRef={it.isNext ? nextRef : undefined}
          />
        ))}
      </div>
    </div>
  )
}
