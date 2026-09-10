/**
 * TimeGridView — 시간표 "그리드 보기"(DESIGN.md 시안 "시간표 · A") 4열 격자.
 *
 * 리스트 보기(HourGroupTimetable)와 같은 items를 받아 같은 하루를 다른 배치로만
 * 보여준다. 다음 차 한 대만 accent로 채우고 지난 시각은 흐리게 두는 규칙도 같다.
 * 날짜 계산은 호출부가 끝내고 이 컴포넌트는 그리기만 한다.
 *
 * 지하철 시트(subway/GlobalSubwayDetailSheet)와 버스 상세(ScheduleDetailModal,
 * bus/TimetableSection)가 함께 쓴다 — 예전엔 ScheduleDetailModal 안에 있어서
 * 이 격자 하나 쓰려고 1300줄짜리 모달 모듈을 통째로 끌어와야 했다.
 *
 * @param {Array<{key,time,isPast,isNext,isLast}>} items
 * @param {React.RefObject} [gridRef] - 다음 차 칸에 붙일 ref(자동 스크롤용).
 */
export default function TimeGridView({ items, gridRef }) {
  if (!items.length) return null
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((it) => (
        <div
          key={it.key}
          ref={it.isNext ? gridRef : undefined}
          className={`relative text-center py-2.5 px-1 rounded-mini text-sm font-semibold tabular-nums tracking-tight transition-colors ${
            it.isNext
              ? 'bg-accent dark:bg-accent text-white font-bold'
              : it.isPast
                ? 'bg-transparent text-mute dark:text-mute'
                : 'bg-surface-2 dark:bg-bg text-ink-2 dark:text-ink-2'
          }`}
        >
          {it.time}
          {it.isLast && !it.isNext && (
            <span className="absolute -top-1.5 -right-1 text-micro font-bold px-1 rounded-full bg-ink dark:bg-line-strong text-white dark:text-ink leading-tight">
              막차
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
