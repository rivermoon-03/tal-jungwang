import { MapPin } from 'lucide-react'
import TimeChip from '../schedule/TimeChip'
import HourGroupBlock from '../schedule/HourGroupBlock'
import NowAnchorLine from '../schedule/NowAnchorLine'
import { anchorLabel, findAnchorSplit, insertAnchorLine } from '../schedule/timetableGroups'
import { parseReturnNote } from './shuttleSchedule'

/**
 * ShuttleTimetableGroups — 셔틀 상세 시간표 본문(시안 "시간표 화면").
 *
 * buildShuttleGroups()가 만든 순서 있는 그룹(hour/frequent/return)을 그리고,
 * "지나간 차"와 "다음 차" 사이에 "지금" 앵커를 끼워 넣는다. "다음" 항목이
 * 그룹의 첫 항목이 아니면 그룹 중간에서 갈라 넣어야 한다(결함 4) — 예전처럼
 * 그룹 전체 뒤에 무조건 넣으면, 다음 항목이 그 그룹의 마지막 항목일 때
 * 다음 항목이 앵커보다 위(과거 쪽)에 그려져 이미 지나간 차처럼 보인다.
 * hour 그룹은 HourGroupBlock에 갈라 넣을 위치를 넘기고, frequent/return
 * 그룹은 같은 계산 결과를 insertAnchorLine으로 직접 적용한다.
 *
 * 자동 스크롤 자체는 이 컴포넌트가 하지 않는다 — 호출부(ShuttleContent)가 이미
 * scrollContainerRef + nextRef(scrollToCenter)로 처리하고 있고, 이 컴포넌트는
 * "다음" 칩에 nextRef를 붙여주기만 한다. scrollIntoView(BusTimetableDetail의
 * 검증된 패턴)는 시트 조상까지 스크롤을 밀어 헤더를 잘라먹는 문제가 있어
 * 모달 컨텍스트에서는 쓰지 않는다(NarrowPhoneStrip 주석 참고).
 *
 * @param {object[]} groups - buildShuttleGroups(annotateShuttleEntries(...))
 * @param {Date} now
 * @param {boolean} showAnchor - 폴백(주말→평일)·미리보기 모드에선 "지금" 개념이
 *   무의미해(오늘 기준이 아니므로) 앵커를 숨긴다.
 * @param {boolean} isOutbound - 등교(direction 0/2) 여부. 회차편 블록의 승차
 *   안내("정왕역 파리바게뜨 건너편")는 등교에서만 의미가 있다.
 * @param {React.RefObject} nextRef
 */
export default function ShuttleTimetableGroups({ groups, now, showAnchor = true, isOutbound = false, nextRef }) {
  const flatItems = groups.flatMap((g) => g.items)
  const nextItem = flatItems.find((it) => it.isNext)
  const label = showAnchor ? anchorLabel(now, nextItem?.time ?? null) : null
  const split = showAnchor ? findAnchorSplit(groups, nextItem?.key ?? null) : null

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, groupIndex) => {
        const isAnchorGroup = split?.groupIndex === groupIndex
        const anchorAfterIndex = isAnchorGroup ? split.insideAfterIndex : null

        return (
          <div key={group.key} className="flex flex-col gap-3">
            {isAnchorGroup && split.insideAfterIndex === null && <NowAnchorLine label={label} />}

            {group.type === 'hour' && (
              <HourGroupBlock
                hour={group.hour}
                items={group.items}
                hasLast={group.items.some((it) => it.isLast)}
                nextRef={nextRef}
                anchorAfterIndex={anchorAfterIndex}
                anchorLabel={label}
              />
            )}

            {group.type === 'frequent' && (
              <div className="rounded-tile bg-surface-2 dark:bg-bg p-3">
                <p className="text-meta font-bold text-mute dark:text-mute mb-2">
                  10분 간격 수시운행
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {insertAnchorLine(group.items, anchorAfterIndex, label, (it) => (
                    <TimeChip
                      key={it.key}
                      time={it.time}
                      isPast={it.isPast}
                      isNext={it.isNext}
                      chipRef={it.isNext ? nextRef : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {group.type === 'return' && (
              <div className="rounded-tile bg-surface-2 dark:bg-bg p-3">
                {isOutbound && (
                  <p className="flex items-start gap-1.5 text-meta font-semibold text-mute dark:text-mute mb-2">
                    <MapPin size={12} aria-hidden className="mt-0.5 shrink-0" />
                    정왕역 파리바게뜨 건너편 승차
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {insertAnchorLine(group.items, anchorAfterIndex, label, (it) => {
                    const { isFrequentReturn, originTime } = parseReturnNote(it.note)
                    const sub = isFrequentReturn
                      ? '수시운행 회차'
                      : originTime
                        ? `학교 ${originTime} 출발`
                        : null
                    return (
                      <TimeChip
                        key={it.key}
                        time={it.time}
                        sub={sub}
                        isPast={it.isPast}
                        isNext={it.isNext}
                        lastBadge={it.isLast}
                        chipRef={it.isNext ? nextRef : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
