/**
 * BusEtaCard — 실시간 노선 시트 상단 ETA 카드.
 *
 * 세 가지 상태 (props로 분기, 매 시점 정확히 하나만 렌더):
 *   1) realtimeEta 있음   → "실시간" chip + 큰 ETA + 다음 한 대 (선택)
 *   2) predictedEta 있음  → "예상치" chip + "보통 HH:MM쯤 도착" + prose
 *   3) 둘 다 null         → "도착 정보 없음" chip + dash + prose
 *
 * 실시간 모드는 useNow(1000) tick으로 arrive_in_seconds를 매초 깎아 표시한다.
 * history-preview 응답이 1초마다 들어오지 않아도 카운트다운이 흐른다.
 *
 * 디자인 토큰 출처: frontend/tailwind.config.js
 */
import { memo, useMemo, useState } from 'react'
import { useNow } from '../../hooks/useNow'
import StatusChip from '../ui/StatusChip'
import DataBadge from '../ui/DataBadge'

// arrive_in_seconds → 표시 문자열 + imminent 여부
function formatEtaLocal(sec) {
  if (sec == null) return { text: '·', imminent: false }
  if (sec < 0) return { text: '이미 도착', imminent: true }
  if (sec < 60) return { text: '곧 도착', imminent: true }
  const mins = Math.ceil(sec / 60)
  return { text: `${mins}분 후`, imminent: sec <= 180 }
}

function BusEtaCard({ realtimeEta = null, predictedEta = null }) {
  // 실시간일 때만 1초 tick. 다른 상태에서는 tick 등록 X.
  const hasRealtime = !!realtimeEta?.primary
  // 경과 시간 계산의 기준 시각. 렌더 중에 Date.now()를 부르면 순수하지 않으므로
  // tick 훅이 준 값을 그대로 기준으로 삼는다(초 단위 계산이라 정밀도는 충분하다).
  const now = useNow(hasRealtime ? 1000 : 60_000)
  const [fetchedAt, setFetchedAt] = useState(now)
  // realtimeEta 객체가 새로 들어올 때마다 기준 시각 갱신(렌더 중 조정).
  const [seenEta, setSeenEta] = useState(realtimeEta)
  if (realtimeEta !== seenEta) {
    setSeenEta(realtimeEta)
    setFetchedAt(now)
  }

  const tickedRealtime = useMemo(() => {
    if (!hasRealtime) return null
    const elapsedSec = Math.max(0, Math.floor((now - fetchedAt) / 1000))
    const tick = (item) => {
      if (!item || item.arrive_in_seconds == null) return item
      return { ...item, arrive_in_seconds: item.arrive_in_seconds - elapsedSec }
    }
    return {
      primary: tick(realtimeEta.primary),
      secondary: tick(realtimeEta.secondary),
    }
  }, [hasRealtime, realtimeEta, now, fetchedAt])

  // ── 상태 1: 실시간 ────────────────────────────────────────────────
  if (hasRealtime) {
    const primary = tickedRealtime.primary
    const secondary = tickedRealtime.secondary
    const { text: primaryText, imminent } = formatEtaLocal(primary.arrive_in_seconds)
    const hasSecondary = secondary && secondary.arrive_in_seconds != null
    const secondaryText = hasSecondary ? formatEtaLocal(secondary.arrive_in_seconds).text : null
    // A4 — ETA 자가 채점(bus_eta_accuracy). 표본 50 이상인 노선·정류장만 백엔드가
    // 값을 실어 주므로, 없으면 아무 말도 하지 않는다(모르는 것을 아는 척하지 않는다).
    const accuracy = realtimeEta.eta_accuracy ?? null
    const accuracyGood = accuracy != null && accuracy.within60_ratio >= 0.8

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 pb-1.5">
          <DataBadge state="live" />
          <span className="text-label font-semibold text-mute dark:text-mute ml-auto">
            실시간 수신 중
          </span>
        </div>
        <div>
          <div
            className={`text-eta-mob font-bold tabular-nums ${
              imminent
                ? 'text-imminent dark:text-imminent'
                : 'text-ink dark:text-ink'
            }`}
          >
            {primaryText}
          </div>
          {primary.arrive_at_hhmm && (
            <div className="text-label font-semibold text-mute dark:text-mute mt-1">
              {primary.arrive_at_hhmm} 도착 예정
            </div>
          )}
          {hasSecondary && (
            <>
              <div className="h-px bg-line dark:bg-line my-2.5" />
              <div className="flex items-baseline gap-2">
                <span className="text-label font-semibold text-mute dark:text-mute">
                  다음 한 대
                </span>
                <span className="text-body font-semibold text-ink dark:text-ink tabular-nums">
                  {secondaryText}
                </span>
              </div>
            </>
          )}
          {accuracy && (
            // 최근 4주 실측 자가 채점 한 줄. 잘 맞는 노선(±1분 내 80% 이상)은
            // 신뢰를, 편차 큰 노선은 여유 이동을 말한다 — 색만으로 구분하지 않고
            // 문구 자체가 다르다.
            <p
              className={`mt-2 text-[12.5px] font-medium ${
                accuracyGood
                  ? 'text-ease dark:text-ease'
                  : 'text-imminent dark:text-imminent'
              }`}
            >
              {accuracyGood
                ? `최근 4주 실측: 예측 ±1분 내 도착 ${Math.round(accuracy.within60_ratio * 100)}%`
                : '예측 편차가 큰 노선이에요 · 여유 있게 이동하세요'}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── 상태 2: 예상치 ────────────────────────────────────────────────
  if (predictedEta?.hhmm) {
    const dayLabel = predictedEta.day_label ?? null
    const sampleSize = predictedEta.sample_size ?? null
    const emphasis =
      dayLabel && sampleSize
        ? `최근 ${dayLabel} ${sampleSize}번 도착 기록`
        : sampleSize
        ? `최근 ${sampleSize}번 도착 기록`
        : `최근 도착 기록`

    return (
      <div className="mb-4">
        <div className="flex items-center gap-2 pb-1.5">
          <StatusChip kind="ease">예상치</StatusChip>
          <span className="text-label font-semibold text-mute dark:text-mute ml-auto">
            현재 도착 정보 없음
          </span>
        </div>
        <div>
          {/* 각 조각을 flex-wrap 아이템으로 분리 — 큰 숫자(text-eta-mob, lineHeight 1.0)와
              작은 단어("보통"/"쯤 도착")를 한 인라인 블록에 섞으면 좁은 폭에서 줄바꿈될 때
              줄간격이 없어 다음 줄과 겹쳐 보이는 문제가 있었다(실사용 리포트: 3400·99-2). */}
          <div className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5">
            <span className="text-body font-semibold text-ink dark:text-ink">보통</span>
            <span className="text-eta-mob font-bold tabular-nums text-ink dark:text-ink">{predictedEta.hhmm}</span>
            <span className="text-body font-semibold text-mute dark:text-mute">쯤 도착</span>
          </div>
          <p className="mt-2 text-caption leading-relaxed font-medium text-ink-2 dark:text-ink-2">
            <b className="font-semibold text-ink dark:text-ink">{emphasis}</b>
            의 중앙값이에요. 실시간 도착 정보가 일시적으로 들어오지 않고 있어요.
          </p>
        </div>
      </div>
    )
  }

  // ── 상태 3: 도착 정보 없음 ─────────────────────────────────────────
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 pb-1.5">
        <StatusChip kind="last">도착 정보 없음</StatusChip>
      </div>
      <div>
        <div className="text-eta-mob font-bold text-mute dark:text-mute">·</div>
        <p className="mt-2 text-caption leading-relaxed font-medium text-ink-2 dark:text-ink-2">
          지금 실시간 도착 정보가 들어오지 않고, 같은 요일·시간대 과거 기록도 충분하지 않아 평소
          도착 시각을 알려드리기 어려워요.
        </p>
      </div>
    </div>
  )
}

export default memo(BusEtaCard)
