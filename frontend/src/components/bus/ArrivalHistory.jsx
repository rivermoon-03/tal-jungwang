import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import { computeHeadwayRangeMin, headwayRangeLabel } from './arrivalHistoryStats'

// 개별 도착 기록 셀. position에 따라 스타일이 달라진다.
//   past    — "지금" 이전 시각. ink-2(옅은 잉크) 톤으로만 구분한다.
//   closest — accent 강조 배지, 라벨 "지금과 비슷"
//   after   — "지금" 이후 시각. 기본 ink 톤(과거 항목보다 상대적으로 진하다).
//
// 결함 #30: 과거 항목을 opacity-35로 흐리게 하면 "유령 글씨"처럼 보여 실제
// 도착 시각인지 판독하기 어려웠다. 불투명도 대신 잉크 2단(ink-2/ink)만으로
// 구분한다 — 어느 시각이든 또렷하게 읽힌다.
function HistoryCell({ item }) {
  const { time, position } = item

  if (position === 'closest') {
    return (
      <div className="text-center rounded-button py-2.5 px-1 bg-accent-bg text-accent-ink">
        <div className="text-display font-semibold leading-none tracking-tight tabular-nums">
          {time}
        </div>
        <div className="mt-1 text-caption font-semibold">지금과 비슷</div>
      </div>
    )
  }

  return (
    <div className="text-center rounded-button py-2.5 px-1">
      <div
        className={[
          'text-display font-semibold leading-none tracking-tight tabular-nums',
          position === 'past' ? 'text-ink-2 dark:text-ink-2-dark' : 'text-ink dark:text-ink',
        ].join(' ')}
      >
        {time}
      </div>
    </div>
  )
}

/**
 * ArrivalHistory — 노선 상세 페이지 ⑤ 도착 기록(같은 요일 3주치 비교: 지난주/2주 전/3주 전).
 *
 * 오늘 예정 시각은 표시하지 않는다. 각 날짜 컬럼은 현재 시각과 가장 가까운 기록(closest)을
 * 중심으로 이전 최대 2건 + 이후 최대 3건(총 최대 6건)의 윈도우를 독립적으로 보여준다.
 *
 * 결함 #30 잔여 개선:
 *  - history-preview API가 같은 요일 3주치(-7/-14/-21일)를 주므로, 헤더는
 *    "지난주/2주 전/3주 전" + 부제 "오늘과 같은 요일 최근 3주 기록"으로
 *    "왜 이 3일인지"를 설명한다(과거엔 요일이 다른 3일이 맥락 없이 나열됐다).
 *  - "도착함" 라벨을 12번 반복하지 않는다(시각만).
 *  - 과거 항목은 opacity가 아니라 ink-2 톤으로만 구분(유령 글씨 금지).
 *  - 하단 결론 문장을 "이 시간대엔 보통 N~M분 간격"으로 대체한다 — 표시된
 *    기록에서 직접 계산한 값이다(columns 원본에서 now 기준 창을 계산).
 *
 * Props:
 *   rows           utils/historyAdapter.js의 toHistoryRows 반환값(윈도우 적용된 셀 목록)
 *   routeNumber    string — 노선 번호. 현재 렌더에는 쓰이지 않지만 호출부(RouteDetailPage)
 *                  와의 prop 계약 호환을 위해 시그니처에 유지한다.
 *   columnLabels   { yesterday: string, dayBefore: string, lastWeek: string } | null — 실제 날짜 라벨
 *   columns        history-preview API의 원본 columns(윈도우 적용 전 전체 시각) — 배차 간격 계산용.
 *   dayLabel       string|null — "평일"/"토요일"/"일/공휴일" 등 오늘 요일 라벨(하단 결론 문장용)
 *   now            Date — 배차 간격 계산 기준 시각(테스트 주입용, 기본 new Date())
 */
// eslint-disable-next-line no-unused-vars -- routeNumber: 호출부 호환용, 향후 뱃지 표시 대비
export default function ArrivalHistory({ rows, routeNumber, columnLabels, columns, dayLabel, now }) {
  const hasData = Array.isArray(rows) && rows.length > 0

  const headerByKey = {
    yesterday: columnLabels?.yesterday ?? '지난주',
    dayBefore: columnLabels?.dayBefore ?? '2주 전',
    lastWeek: columnLabels?.lastWeek ?? '3주 전',
  }

  const range = computeHeadwayRangeMin(columns, now instanceof Date ? now : new Date())
  const footerText = range
    ? `${dayLabel ? `${dayLabel} ` : ''}이 시간대엔 보통 ${headwayRangeLabel(range)}`
    : '과거 도착 시각을 참고해 직접 가늠해보세요'

  return (
    <Card>
      {!hasData ? (
        // 결함(신규) — 왜 비어 있는지 말하지 않으면 사용자는 고장으로 읽는다.
        // history-preview API는 수집 시작 시점을 내려주지 않아 없는 날짜를
        // 지어낼 수 없다(백엔드 app/api/bus.py bus_history_preview 응답 확인).
        // 화면이 아는 사실 — "오늘과 같은 요일 3주 비교" 구조 — 만으로 설명한다.
        <EmptyState
          title="아직 비교할 기록이 없어요"
          desc="오늘과 같은 요일 기록이 쌓이면 지난 도착 시각과 비교해 드려요. 지금은 데이터를 모으는 중이에요."
        />
      ) : (
        <>
          {/* 섹션 헤더 — "왜 이 3일인지" 설명을 덧붙인다 */}
          <div className="mb-3">
            <h3 className="text-body font-bold text-ink dark:text-ink">이 시간대 실제 도착</h3>
            <p className="text-caption font-semibold text-mute dark:text-mute mt-0.5">
              오늘과 같은 요일 최근 3주 기록
            </p>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {rows.map((col) => (
              <div
                key={col.key}
                className="text-center text-caption font-bold text-mute pb-2 border-b border-line"
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
                    <div className="text-display font-semibold leading-none tracking-tight text-mute">
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

          {/* 하단 결론 — 기록에서 계산한 배차 간격. 계산 불가하면 안내 문구로 대체. */}
          <p className="mt-4 text-caption text-mute text-center">{footerText}</p>
        </>
      )}
    </Card>
  )
}
