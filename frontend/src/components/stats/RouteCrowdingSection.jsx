/**
 * RouteCrowdingSection — 노선 상세(RouteDetailPage)의 "이 노선 평소 혼잡도" 시각화.
 *
 * 데이터 출처: GET /api/v1/bus/crowding/{route_number} (기존 useCrowdingFlow 훅 재사용).
 * 백엔드가 day_type을 weekday/weekend 2종만 지원해(요일별 7분류 아님),
 * "요일×시간" 그리드는 평일/주말 2행 × 24시간 열로 구성한다.
 *
 * 이 컴포넌트는 실시간 추적 노선(gbis_route_id 존재)에서만 의미 있는 데이터가 쌓이므로
 * 호출부(RouteDetailPage)가 isRealtime===true일 때만 마운트해야 한다.
 *
 * 정시성(예정 시각 대비 실제 도착 delta)은 이 화면에 없다 — 백엔드
 * bus_arrival_stats/bus_crowding_stats 어디에도 "예정 시각" 필드가 없고
 * bus_arrival_history는 실제 도착 간격(headway)만 기록해, 정시성 delta를
 * 만들 근거 데이터가 없다(추정치를 지어내지 않기 위해 이 지표는 생략).
 */
import { useMemo } from 'react'
import { useCrowdingFlow } from '../../hooks/useCrowdingFlow'
import { crowdedLabel } from '../../utils/crowdingPalette'
import { mergeToHourly, crowdedToneStyle, isWeekendNow } from '../../utils/crowdingHeatmap'
import { getKstHour } from '../../utils/timeOfDay'
import EmptyState from '../ui/EmptyState'

const ROW_DEFS = [
  { dayType: 'weekday', label: '평일' },
  { dayType: 'weekend', label: '주말' },
]

const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21]

export default function RouteCrowdingSection({ routeNumber }) {
  const { data: weekdayFlow, loading: weekdayLoading, error: weekdayError } = useCrowdingFlow(routeNumber, 'weekday')
  const { data: weekendFlow, loading: weekendLoading, error: weekendError } = useCrowdingFlow(routeNumber, 'weekend')

  const rows = useMemo(() => ([
    { ...ROW_DEFS[0], flow: weekdayFlow, hourly: mergeToHourly(weekdayFlow?.points) },
    { ...ROW_DEFS[1], flow: weekendFlow, hourly: mergeToHourly(weekendFlow?.points) },
  ]), [weekdayFlow, weekendFlow])

  const totalSamples = (weekdayFlow?.total_samples ?? 0) + (weekendFlow?.total_samples ?? 0)
  const stopName = weekdayFlow?.stop_name ?? weekendFlow?.stop_name ?? null

  const loading = (weekdayLoading || weekendLoading) && totalSamples === 0
  const bothErrored = weekdayError && weekendError
  const hasData = totalSamples > 0

  // "지금 이 시간대" 하이라이트 — 실제 오늘 요일/시각 기준(선택된 요일 탭과 무관하게
  // "지금"의 의미를 유지하기 위해 CrowdingCard 등 기존 통계 카드와 동일한 관례를 따른다).
  // KST 기준(timezone-aware) — 로컬 브라우저 시각(new Date().getHours()/getDay())을
  // 직접 쓰지 않는다(CLAUDE.md 철칙, mistakes.md 규칙1).
  const now = new Date()
  const liveDayType = isWeekendNow(now) ? 'weekend' : 'weekday'
  const liveHour = getKstHour(now)
  const liveRow = rows.find((r) => r.dayType === liveDayType)
  const liveBucket = liveRow?.hourly.find((b) => b.hour === liveHour) ?? null

  if (loading) {
    return (
      <section aria-label="노선 혼잡도">
        <EmptyState title="혼잡도 정보를 불러오는 중이에요" />
      </section>
    )
  }

  if (bothErrored || !hasData) {
    return (
      <section aria-label="노선 혼잡도">
        <div className="mb-2">
          <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em]">
            노선 혼잡도
          </h2>
        </div>
        <EmptyState
          title="아직 혼잡도 데이터가 없어요"
          desc="이 노선은 혼잡도 누적 데이터가 충분히 쌓이지 않았어요"
        />
      </section>
    )
  }

  return (
    <section aria-label="노선 혼잡도">
      <div className="mb-2">
        <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em]">
          노선 혼잡도
        </h2>
        <p className="text-caption text-mute dark:text-mute mt-0.5">
          {stopName ? `${stopName} 기준 최근 GBIS 혼잡도 누적치예요` : '최근 GBIS 혼잡도 누적치예요'}
        </p>
      </div>

      {/* 지금 하이라이트 */}
      <div className="rounded-card bg-surface-2 dark:bg-bg border border-line dark:border-line px-3.5 py-3 mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-caption text-mute dark:text-mute font-semibold">
            지금({liveDayType === 'weekday' ? '평일' : '주말'} {liveHour}시)
          </span>
          <span className="block text-body font-bold text-ink dark:text-ink mt-0.5">
            {liveBucket?.crowded != null ? crowdedLabel(liveBucket.crowded) : '정보 없음'}
          </span>
        </div>
        {liveBucket?.samples > 0 && (
          <span className="text-caption text-mute dark:text-mute shrink-0">
            표본 {liveBucket.samples}건
          </span>
        )}
      </div>

      {/* 요일×시간 히트맵: 2행(평일/주말) × 24열(시) */}
      <div className="rounded-card bg-surface dark:bg-surface border border-line dark:border-line p-3 overflow-x-auto">
        <div className="min-w-[560px]">
          {rows.map((row) => (
            <div key={row.dayType} className="flex items-center gap-2 mb-1.5 last:mb-0">
              <span className="w-8 shrink-0 text-caption font-semibold text-mute dark:text-mute">
                {row.label}
              </span>
              <div className="flex-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
                {row.hourly.map((b) => {
                  const tone = crowdedToneStyle(b.crowded)
                  const label = b.crowded != null
                    ? `${row.label} ${b.hour}시: ${crowdedLabel(b.crowded)} (표본 ${b.samples}건)`
                    : `${row.label} ${b.hour}시: 데이터 없음`
                  return (
                    <div
                      key={b.hour}
                      role="img"
                      aria-label={label}
                      title={label}
                      className={`h-5 rounded-[3px] ${tone.className}`}
                      style={tone.style}
                    />
                  )
                })}
              </div>
            </div>
          ))}

          {/* 시간 축 라벨 (0/3/6/9/12/15/18/21시) */}
          <div className="flex items-center gap-2 mt-1">
            <span className="w-8 shrink-0" />
            <div className="flex-1 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[2px]">
              {Array.from({ length: 24 }, (_, h) => (
                <span key={h} className="text-center text-caption text-mute dark:text-mute leading-none">
                  {HOUR_TICKS.includes(h) ? h : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 범례 — 색만으로 구분하지 않도록 텍스트 병기 */}
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <LegendDot toneCrowded={1} text="여유" />
        <LegendDot toneCrowded={2.5} text="보통" />
        <LegendDot toneCrowded={3.5} text="혼잡" />
        <LegendDot toneCrowded={4} text="매우혼잡" />
        <LegendDot toneCrowded={null} text="데이터 없음" />
      </div>
    </section>
  )
}

function LegendDot({ toneCrowded, text }) {
  const tone = crowdedToneStyle(toneCrowded)
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-mute dark:text-mute font-medium">
      <span className={`w-2.5 h-2.5 rounded-full ${tone.className}`} style={tone.style} />
      {text}
    </span>
  )
}
