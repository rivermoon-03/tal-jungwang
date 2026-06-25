import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'

// 개별 비교 row (어제 / 이틀 전 / 7일 전 3칸)
function CompareRow({ row }) {
  const { yesterday, dayBefore, lastWeek } = row

  return (
    <div className="grid grid-cols-3 gap-2">
      {/* 어제 (도착) */}
      <div className="text-center rounded-[10px] py-3 px-1">
        <div className="text-[18px] font-extrabold leading-none tracking-tight text-ink-2 tabular-nums">
          {yesterday ?? '-'}
        </div>
        <div className="mt-1 text-label text-mute">도착함</div>
      </div>

      {/* 이틀 전 (도착) */}
      <div className="text-center rounded-[10px] py-3 px-1">
        <div className="text-[18px] font-extrabold leading-none tracking-tight text-ink-2 tabular-nums">
          {dayBefore ?? '-'}
        </div>
        <div className="mt-1 text-label text-mute">도착함</div>
      </div>

      {/* 7일 전 (도착) */}
      <div className="text-center rounded-[10px] py-3 px-1">
        <div className="text-[18px] font-extrabold leading-none tracking-tight text-ink-2 tabular-nums">
          {lastWeek ?? '-'}
        </div>
        <div className="mt-1 text-label text-mute">도착함</div>
      </div>
    </div>
  )
}

/**
 * ArrivalHistory — 비교형 (어제 도착 / 이틀 전 도착 / 7일 전 도착)
 *
 * 오늘 예정 시각은 표시하지 않는다. 과거(어제·이틀전·7일전) 도착 기록을
 * 참고해 사용자가 직접 예측하도록 안내한다.
 *
 * Props:
 *   rows           { slot, yesterday, dayBefore, lastWeek, delta: null }[]
 *   routeNumber    string — 노선 번호 (뱃지 표시)
 *   columnLabels   { yesterday: string, dayBefore: string, lastWeek: string } | null — 실제 날짜 라벨
 */
export default function ArrivalHistory({ rows, routeNumber, columnLabels }) {
  const hasData = Array.isArray(rows) && rows.length > 0

  const yesterdayHeader = columnLabels?.yesterday ?? '어제'
  const dayBeforeHeader = columnLabels?.dayBefore ?? '이틀 전'
  const lastWeekHeader = columnLabels?.lastWeek ?? '7일 전'

  return (
    <Card>
      {!hasData ? (
        <EmptyState
          title="아직 도착 기록이 충분하지 않아요"
          desc="데이터가 쌓이면 이전 시간과 비교해 드릴게요."
        />
      ) : (
        <>
          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center text-label font-bold text-mute pb-2 border-b border-line">
              {yesterdayHeader}
            </div>
            <div className="text-center text-label font-bold text-mute pb-2 border-b border-line">
              {dayBeforeHeader}
            </div>
            <div className="text-center text-label font-bold text-mute pb-2 border-b border-line">
              {lastWeekHeader}
            </div>
          </div>

          {/* 비교 rows */}
          <div className="flex flex-col gap-3">
            {rows.map((row, i) => (
              <CompareRow key={row.slot ?? i} row={row} />
            ))}
          </div>

          {/* 하단 안내 — 예측 미제공, 사용자 직접 가늠 유도 */}
          <p className="mt-4 text-caption text-mute text-center">
            과거 도착 시각을 참고해 직접 가늠해보세요
          </p>
        </>
      )}
    </Card>
  )
}
