/**
 * crowdingSummary.js — 노선 상세 ④ 혼잡도 요약 전용 순수 계산 유틸.
 *
 * 표시 기준은 평균이 아니라 **혼잡 비율**(그 시간대 도착 버스 중 등급 3 이상 비율)이다.
 * 평균은 하한이 1이라 값 1인 버스와 3인 버스가 반씩이면 2("보통")가 나오는데, 그 2는
 * 실제로 존재한 어떤 버스도 설명하지 못한다. 시흥33 하교 17시가 실측 ≥3 비율 46.6%인데
 * 화면에서 "보통"이던 원인이다.
 *
 * 히트맵 칸은 2시간을 유지한다(24칸은 390px 뷰포트를 넘는다). 대신 **요약 문장의 피크와
 * 현재 라벨은 1시간 해상도로** 읽는다 — 16시(8.9%)와 17시(46.6%)를 합쳐 버리면 피크가
 * 조용한 옆 시간에 희석된다.
 *
 * 라벨 규칙은 utils/crowdingLevel 단일 출처를 쓴다.
 * 설계: docs/superpowers/specs/2026-08-02-bus-crowding-thresholds-design.md
 */
import { labelFromRatio } from '../../utils/crowdingLevel'

/** 표본 가중으로 시간 버킷들을 하나로 합친다. 표본이 없으면 ratio=null. */
function combine(entries) {
  let weighted = 0
  let samples = 0
  let estimated = false
  let reliable = false
  for (const e of entries) {
    if (!e || e.samples <= 0 || e.ratio == null) continue
    weighted += e.ratio * e.samples
    samples += e.samples
    // 한 시간이라도 보정으로 올라갔으면 이 칸은 순수 관측이 아니다.
    if (e.estimated) estimated = true
    if (e.reliable !== false) reliable = true
  }
  return {
    ratio: samples > 0 ? weighted / samples : null,
    samples,
    estimated,
    reliable: samples > 0 ? reliable : true,
  }
}

/**
 * mergeToTwoHourBuckets(hourly) — 24시간 버킷 → 12칸 2시간 버킷(히트맵용).
 *
 * @param {Array<{hour:number, ratio:number|null, samples:number, estimated?:boolean, reliable?:boolean}>} hourly
 * @returns {Array<{startHour:number, endHour:number, ratio:number|null, samples:number, estimated:boolean, reliable:boolean}>}
 */
export function mergeToTwoHourBuckets(hourly) {
  const safe = Array.isArray(hourly) ? hourly : []
  const byHour = new Map(safe.map((b) => [b.hour, b]))
  const buckets = []
  for (let start = 0; start < 24; start += 2) {
    buckets.push({
      startHour: start,
      endHour: start + 2,
      ...combine([byHour.get(start), byHour.get(start + 1)]),
    })
  }
  return buckets
}

/**
 * summarizeCrowding(hourly, nowHour) — 문장 요약에 필요한 값을 한 번에 계산.
 *
 * @returns {{
 *   buckets: Array,                          // 2시간 12칸(히트맵용)
 *   nowLabel: string|null,                   // 지금 "시간"의 라벨(1시간 해상도)
 *   peak: {hour:number, label:string}|null,  // 가장 붐비는 "시간"(1시간 해상도)
 *   hasVariance: boolean,                    // 라벨이 갈리는가(히트맵 표시 근거)
 * } | null}  표본이 전혀 없으면 null.
 */
export function summarizeCrowding(hourly, nowHour) {
  const safe = Array.isArray(hourly) ? hourly : []
  const buckets = mergeToTwoHourBuckets(safe)
  const withData = safe.filter((b) => b && b.samples > 0 && b.ratio != null)
  if (withData.length === 0) return null

  const nowEntry = withData.find((b) => b.hour === nowHour) ?? null
  const nowLabel = nowEntry
    ? labelFromRatio(nowEntry.ratio, {
        estimated: nowEntry.estimated,
        reliable: nowEntry.reliable !== false,
      })
    : null

  // 표본이 부족한 시간은 비율의 분산이 커서 피크로 뽑으면 오해를 만든다.
  // 전부 부족하면 어쩔 수 없이 전체에서 고른다.
  const reliablePool = withData.filter((b) => b.reliable !== false)
  const pool = reliablePool.length > 0 ? reliablePool : withData

  let peakEntry = pool[0]
  for (const b of pool) {
    if (b.ratio > peakEntry.ratio) peakEntry = b
  }
  const peak = {
    hour: peakEntry.hour,
    label: labelFromRatio(peakEntry.ratio, {
      estimated: peakEntry.estimated,
      reliable: peakEntry.reliable !== false,
    }),
  }

  const labelSet = new Set(
    withData.map((b) => labelFromRatio(b.ratio, { reliable: b.reliable !== false }))
  )
  const hasVariance = labelSet.size > 1

  return { buckets, nowLabel, peak, hasVariance }
}
