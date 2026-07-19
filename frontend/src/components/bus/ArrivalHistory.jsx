import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import { formatHHMMFromDate } from '../../utils/historyAdapter'

// 개별 도착 기록 셀. position에 따라 스타일이 달라진다.
//   past    — 흐리게(opacity), 라벨 "도착함"
//   closest — accent 강조 배지, 라벨 "지금과 비슷"
//   after   — 기본 스타일, 라벨 "도착함"
function HistoryCell({ item }) {
  const { time, position } = item

  if (position === 'closest') {
    return (
      <div className="text-center rounded-button py-2.5 px-1 bg-accent-bg text-accent-ink">
        <div className="text-[18px] font-semibold leading-none tracking-tight tabular-nums">
          {time}
        </div>
        <div className="mt-1 text-label font-semibold">지금과 비슷</div>
      </div>
    )
  }

  return (
    <div
      className={`text-center rounded-button py-2.5 px-1 ${position === 'past' ? 'opacity-35' : ''}`}
    >
      <div className="text-[18px] font-semibold leading-none tracking-tight text-ink-2 tabular-nums">
        {time}
      </div>
      <div className="mt-1 text-label text-mute">도착함</div>
    </div>
  )
}

/**
 * ArrivalHistory — 비교형 (어제 도착 / 이틀 전 도착 / 7일 전 도착)
 *
 * 오늘 예정 시각은 표시하지 않는다. 각 날짜 컬럼은 현재 시각과 가장 가까운 기록(closest)을
 * 중심으로 이전 최대 2건 + 이후 최대 3건(총 최대 6건)의 윈도우를 독립적으로 보여준다.
 *
 * Props:
 *   rows           { key: 'yesterday'|'dayBefore'|'lastWeek', items: { time, position }[] }[]
 *                  — utils/historyAdapter.js의 toHistoryRows 반환값
 *   routeNumber    string — 노선 번호. 현재 렌더에는 쓰이지 않지만 호출부(RouteDetailPage)
 *                  와의 prop 계약 호환을 위해 시그니처에 유지한다.
 *   columnLabels   { yesterday: string, dayBefore: string, lastWeek: string } | null — 실제 날짜 라벨
 */
// eslint-disable-next-line no-unused-vars -- routeNumber: 호출부 호환용, 향후 뱃지 표시 대비
export default function ArrivalHistory({ rows, routeNumber, columnLabels }) {
  const hasData = Array.isArray(rows) && rows.length > 0

  const headerByKey = {
    yesterday: columnLabels?.yesterday ?? '어제',
    dayBefore: columnLabels?.dayBefore ?? '이틀 전',
    lastWeek: columnLabels?.lastWeek ?? '7일 전',
  }

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
            {rows.map((col) => (
              <div
                key={col.key}
                className="text-center text-label font-bold text-mute pb-2 border-b border-line"
              >
                {headerByKey[col.key]}
              </div>
            ))}
          </div>

          {/* 컬럼별 도착 기록 윈도우 (최대 6건, 서로 독립적) */}
          <div className="grid grid-cols-3 gap-2">
            {rows.map((col) => (
              <div key={col.key} className="flex flex-col gap-2">
                {col.items.length === 0 ? (
                  <div className="text-center rounded-button py-2.5 px-1">
                    <div className="text-[18px] font-semibold leading-none tracking-tight text-mute">
                      -
                    </div>
                  </div>
                ) : (
                  col.items.map((item, i) => (
                    <HistoryCell key={`${col.key}-${item.time}-${i}`} item={item} />
                  ))
                )}
              </div>
            ))}
          </div>

          {/* 하단 안내 — 예측 미제공, 사용자 직접 가늠 유도. 정확히 1회만 렌더. */}
          <p className="mt-4 text-caption text-mute text-center">
            과거 도착 시각을 참고해 직접 가늠해보세요 · 현재 {formatHHMMFromDate(new Date())}
          </p>
        </>
      )}
    </Card>
  )
}
