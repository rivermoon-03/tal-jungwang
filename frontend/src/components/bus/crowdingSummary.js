/**
 * crowdingSummary.js — 노선 상세 페이지 ④ 혼잡도 요약 전용 순수 계산 유틸.
 *
 * 기존 utils/crowdingHeatmap.js의 mergeToHourly(24시간 버킷)를 입력으로 받아
 * "문장 요약 한 줄"과 2시간 단위 12칸 히트맵을 계산한다. 실제 프로덕션 데이터를
 * 확인해보면 GBIS crowded 값이 대부분 1.0~1.2 사이(전부 "여유")로 몰려 있어
 * 24열 히트맵을 그대로 보여주면 정보량이 0에 가깝다 — hasVariance 판정으로
 * 이런 경우 히트맵 자체를 숨기고 문장 요약만 남긴다.
 *
 * crowdedLabel(utils/crowdingPalette.js, 읽기 전용)로 "여유/보통/혼잡/매우혼잡"
 * 4단계 라벨을 구하고, 그 라벨 종류가 2개 이상이면 "분산이 있다"고 판정한다.
 */
import { crowdedLabel } from '../../utils/crowdingPalette'

/**
 * mergeToTwoHourBuckets(hourly) — 24시간(0~23) 버킷 → 2시간 단위 12칸 버킷.
 * 표본수(samples)를 가중치로 삼아 평균한다(mergeToHourly와 동일 원칙).
 *
 * @param {Array<{hour:number, crowded:number|null, samples:number}>} hourly
 * @returns {Array<{startHour:number, endHour:number, crowded:number|null, samples:number}>} 길이 12
 */
export function mergeToTwoHourBuckets(hourly) {
  const safe = Array.isArray(hourly) ? hourly : []
  const byHour = new Map(safe.map((b) => [b.hour, b]))
  const buckets = []
  for (let start = 0; start < 24; start += 2) {
    const a = byHour.get(start)
    const b = byHour.get(start + 1)
    const samplesA = a?.samples ?? 0
    const samplesB = b?.samples ?? 0
    const samples = samplesA + samplesB
    let crowded = null
    if (samples > 0) {
      const weighted = (a?.crowded != null ? a.crowded * samplesA : 0)
        + (b?.crowded != null ? b.crowded * samplesB : 0)
      crowded = weighted / samples
    }
    buckets.push({ startHour: start, endHour: start + 2, crowded, samples })
  }
  return buckets
}

/**
 * summarizeCrowding(hourly, nowHour) — 문장 요약에 필요한 값을 한 번에 계산.
 *
 * @param {Array<{hour:number, crowded:number|null, samples:number}>} hourly - 24시간 버킷
 * @param {number} nowHour - 현재 KST 시(0~23)
 * @returns {{
 *   buckets: Array,               // 2시간 단위 12칸(히트맵용)
 *   nowLabel: string|null,        // 지금 시간대 혼잡도 라벨
 *   peak: {startHour:number, endHour:number, label:string} | null, // 가장 혼잡한 버킷
 *   hasVariance: boolean,         // 라벨 종류가 2개 이상이면 true(히트맵 표시 근거)
 * } | null}  표본이 전혀 없으면 null(호출부가 섹션 자체를 숨기는 신호로 쓴다).
 */
export function summarizeCrowding(hourly, nowHour) {
  const buckets = mergeToTwoHourBuckets(hourly)
  const withData = buckets.filter((b) => b.samples > 0 && b.crowded != null)
  if (withData.length === 0) return null

  const nowBucket = buckets.find((b) => nowHour >= b.startHour && nowHour < b.endHour) ?? null
  const nowLabel = nowBucket?.crowded != null ? crowdedLabel(nowBucket.crowded) : null

  let peakBucket = withData[0]
  for (const b of withData) {
    if (b.crowded > peakBucket.crowded) peakBucket = b
  }
  const peak = {
    startHour: peakBucket.startHour,
    endHour: peakBucket.endHour,
    label: crowdedLabel(peakBucket.crowded),
  }

  const labelSet = new Set(withData.map((b) => crowdedLabel(b.crowded)))
  const hasVariance = labelSet.size > 1

  return { buckets, nowLabel, peak, hasVariance }
}
