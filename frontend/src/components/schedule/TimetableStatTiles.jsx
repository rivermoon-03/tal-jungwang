import { intervalLabel } from '../bus/timetableStats'

/**
 * TimetableStatTiles — 첫차 / 막차 / 배차 3타일 + 심야 운행 공백 안내.
 *
 * 공공버스 노선 상세(bus/TimetableSection)와 셔틀 상세
 * (schedule/ScheduleDetailModal의 ShuttleContent)가 같은 규격을 쓰도록
 * 여기 하나로 모은다. 계산은 bus/timetableStats.computeTimetableSummary가
 * 이미 하므로(overnightGaps 포함) 이 컴포넌트는 그 결과를 그리기만 한다
 * (mistakes.md §2 — 같은 계산을 두 벌로 만들지 않는다).
 *
 * @param {{firstBus:string,lastBus:string,interval:{min:number,max:number}|null,
 *   overnightGaps:Array<{from:string,to:string}>}|null} summary
 *   computeTimetableSummary(times) 결과. null이면 아무것도 그리지 않는다
 *   (호출부가 이미 "시간표 자체가 없음" 처리를 끝냈다고 가정).
 */
export default function TimetableStatTiles({ summary }) {
  if (!summary) return null
  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Tile label="첫차" value={summary.firstBus} />
        <Tile label="막차" value={summary.lastBus} />
        <Tile label="배차" value={intervalLabel(summary.interval) ?? '정보 없음'} />
      </div>

      {/* 심야처럼 운행이 통째로 끊기는 구간은 배차 계산에서 뺐다(위 3타일에는
          안 섞임) — 그 사실 자체를 숨기지 않고 별도 문구로 알려준다. */}
      {summary.overnightGaps.length > 0 && (
        <p className="text-caption text-mute dark:text-mute mb-3">
          {summary.overnightGaps.map((g) => `${g.from}~${g.to} 운행 공백`).join(', ')}
        </p>
      )}
    </>
  )
}

function Tile({ label, value }) {
  return (
    <div className="rounded-button bg-surface-2 dark:bg-bg border border-line dark:border-line px-3 py-2.5 text-center">
      <span className="block text-caption font-semibold text-mute dark:text-mute mb-0.5">{label}</span>
      <span className="block text-body font-bold text-ink dark:text-ink tabular-nums">{value}</span>
    </div>
  )
}
