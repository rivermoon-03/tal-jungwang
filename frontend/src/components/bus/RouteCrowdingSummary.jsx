/**
 * RouteCrowdingSummary — 노선 상세 페이지 ④ 혼잡도 섹션(요약화, 결함 #4/#22).
 *
 * 기존 components/stats/RouteCrowdingSection.jsx는 24열 고정폭 히트맵이라
 * 뷰포트 폭(390px)을 넘어 가로 스크롤이 생기고(15시 이후가 화면 밖으로
 * 밀림), 실제 프로덕션 데이터를 확인해보면 GBIS crowded 값이 대부분
 * 1.0~1.2(전부 "여유")로 몰려 있어 24칸이 전부 같은 초록이라 정보량이
 * 0에 가까웠다. 표본 수·"GBIS" 같은 개발자 용어 노출, 하교인데
 * "○○역 기준"이라 정류장 프레이밍이 사용자의 실제 탑승 정류장과
 * 어긋나는 문제도 있었다.
 *
 * 이 컴포넌트가 그 대체다: 기본은 문장 요약 한 줄("지금은 여유 · 평일
 * 8~9시만 붐벼요")만 보여주고, 펼치면 2시간 버킷 12칸 히트맵(그리드가
 * 뷰포트에 통째로 들어간다)을 보여준다. 등급 분산이 없으면(전부 같은
 * 라벨) 히트맵 자체를 숨기고 문장만 남긴다 — 색만 다른 24칸을 보여주는
 * 것보다 "지금은 여유롭다"는 한 문장이 더 정직하고 유용하다.
 *
 * 기준 정류장은 API가 실제로 돌려주는 stop_name(사용자가 탑승하는 그
 * 정류장)을 그대로 쓴다 — "○○역 기준"처럼 방향과 어긋난 정류장을
 * 지어내지 않는다.
 *
 * 히트맵 셀은 기존 RouteCrowdingSection과 동일하게 3px 라운드를 유지한다
 * (radius 8/10/14/20/full 규칙의 예외 — 그리드 셀처럼 4px 미만이 자연스러운
 * 경우는 기존 값을 유지해도 된다고 통합 지침에 명시됨. 보고서에도 별도 기재).
 */
import { useMemo, useState } from 'react'
import { useCrowdingFlow } from '../../hooks/useCrowdingFlow'
import { mergeToHourly, crowdedToneStyle, isWeekendNow } from '../../utils/crowdingHeatmap'
import { getKstHour } from '../../utils/timeOfDay'
import { summarizeCrowding } from './crowdingSummary'

const HOUR_TICKS = [0, 6, 12, 18]

export default function RouteCrowdingSummary({ routeNumber }) {
  const [expanded, setExpanded] = useState(false)

  const now = new Date()
  const liveDayType = isWeekendNow(now) ? 'weekend' : 'weekday'
  const liveHour = getKstHour(now)
  const dayLabel = liveDayType === 'weekday' ? '평일' : '주말'

  const { data: flow, loading } = useCrowdingFlow(routeNumber, liveDayType)

  const hourly = useMemo(() => mergeToHourly(flow?.points), [flow])
  const summary = useMemo(() => summarizeCrowding(hourly, liveHour), [hourly, liveHour])

  // 로딩 중이거나 표본이 전혀 없으면 섹션 자체를 숨긴다 — "표본 0건" 빈 카드는
  // 정보가 아니다. 실시간 추적 노선에서만 마운트되므로(호출부 조건) 대부분의
  // 경우 곧 데이터가 채워진다.
  if (loading || !summary) return null

  const stopLabel = flow?.stop_name ? `${flow.stop_name} 탑승 기준` : null
  const sentence = summary.hasVariance && summary.peak
    ? `지금은 ${summary.nowLabel ?? '정보 없음'} · ${dayLabel} ${summary.peak.startHour}~${summary.peak.endHour}시만 붐벼요`
    : `지금은 ${summary.nowLabel ?? '정보 없음'} · 시간대별 차이가 크지 않아요`

  return (
    <section aria-label="노선 혼잡도">
      <div className="mb-2">
        <h2 className="text-head font-semibold text-ink dark:text-ink tracking-[-0.01em]">
          노선 혼잡도
        </h2>
        {stopLabel && (
          <p className="text-caption text-mute dark:text-mute mt-0.5">{stopLabel}</p>
        )}
      </div>

      <div
        className="rounded-card bg-surface-2 dark:bg-bg border border-line dark:border-line px-3.5 py-3"
        title={flow?.total_samples ? `표본 ${flow.total_samples}건` : undefined}
      >
        <span className="block text-body font-bold text-ink dark:text-ink">{sentence}</span>
      </div>

      {summary.hasVariance && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-2 text-caption font-semibold text-accent-ink dark:text-accent pressable"
          >
            {expanded ? '시간대별 접기' : '시간대별 자세히 보기'}
          </button>

          {expanded && (
            <div className="mt-2 rounded-card bg-surface dark:bg-surface border border-line dark:border-line p-3">
              <div className="grid grid-cols-12 gap-1">
                {summary.buckets.map((b) => {
                  const tone = crowdedToneStyle(b.crowded)
                  const label = b.crowded != null
                    ? `${b.startHour}~${b.endHour}시: ${dayLabel === '평일' ? '평일' : '주말'} 혼잡도 (표본 ${b.samples}건)`
                    : `${b.startHour}~${b.endHour}시: 데이터 없음`
                  return (
                    <div
                      key={b.startHour}
                      role="img"
                      aria-label={label}
                      title={label}
                      className={`aspect-square rounded-[3px] ${tone.className}`}
                      style={tone.style}
                    />
                  )
                })}
              </div>
              <div className="grid grid-cols-12 mt-1">
                {summary.buckets.map((b) => (
                  <span key={b.startHour} className="text-center text-caption text-mute dark:text-mute leading-none">
                    {HOUR_TICKS.includes(b.startHour) ? b.startHour : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
