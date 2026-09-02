/**
 * ArrivalEtaCard — 노선 상세 페이지 ① 도착 카드.
 *
 * 결함 #30: 노선마다 ETA 슬롯이 제각각(시흥33은 1개, 3400은 2개)이고, 실시간이
 * 아예 없는 노선(5200 등)에는 "실시간 도착 정보가 없어요"+"정해진 출발
 * 시간표가 없는 실시간 운행 노선이에요"라는 서로 모순되는 두 문장이 동시에
 * 떴다. 이 컴포넌트가 상황별로 정확히 한 가지 표시만 하도록 통합한다.
 *
 * 4가지 상태를 모두 이 컴포넌트 하나가 책임진다:
 *  1) 로딩 중            — 중립 안내
 *  2) realtime_eta 있음   — 2열 고정 그리드 [실시간 | 다음 차]. 다음 차 정보가
 *                          없으면(secondary 없음) 시간표 기준 다음 출발로 보강
 *                          (nextScheduled prop), 그마저 없으면 "이후 정보 없음".
 *  3) realtime_eta 없지만 시간표(nextScheduled)가 있음
 *                          — "실시간 신호가 없다"는 모순 카피 대신, 시간표 기준
 *                          다음 출발을 크게 보여준다.
 *  4) 둘 다 없음          — "정해진 시간표 없이 수시 운행" 한 문장 안내.
 *
 * 과거 도착 기록 진입 링크는 이 카드 안에 두지 않는다(⑤ 섹션 자체가 페이지에
 * 항상 존재하므로 "도착 기록 보기" 같은 중복 링크가 필요 없다 — 결함 #30).
 *
 * ETA 숫자 강조는 색만 바꾼다(--tj-imminent) — 배경/보더는 그대로 유지.
 *
 * "초 → 표시 문자열" 변환과 임박(강조) 판정은 utils/eta.js에 위임한다 — 예전엔
 * 이 컴포넌트가 90초 임계를 로컬로 복제해 들고 있어 BusEtaCard(당시 60/180초
 * 이중 임계)와 서로 다른 기준으로 어긋났다.
 *
 * 승차 정류장 표기: 3401처럼 등록된 탑승 정류장이 2곳 이상인 노선은 이 ETA가
 * "어느 정류장 기준"인지 말하지 않으면 승차 지점을 헷갈릴 수 있다. 백엔드
 * /bus/history-preview 응답의 stop_name(카드와 동일 GBIS 추적 정류장 — 서버가
 * 이미 실시간 ETA를 그 정류장으로 한정해 계산한다)을 그대로 "실시간" 라벨
 * 옆에 붙인다. 정류장이 하나뿐인 노선도 표기 자체는 해가 없어 조건 없이 켠다.
 */
import { formatEta, isImminent } from '../../utils/eta'

// arrive_in_seconds → "N분" / "곧 도착" 라벨. null이면 카드 문구는 '정보 없음'.
function etaLabel(sec) {
  if (sec == null) return null
  return formatEta(sec).text
}

export default function ArrivalEtaCard({ histData, histLoading, nextScheduled }) {
  if (histLoading) {
    return (
      <div className="bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3" role="status" aria-live="polite">
        <span className="text-caption font-semibold text-mute dark:text-mute">
          실시간 도착 정보를 가져오는 중이에요
        </span>
      </div>
    )
  }

  const realtimeEta = histData?.realtime_eta ?? null
  // 이 ETA가 기준으로 삼은 승차 정류장 — 백엔드가 realtime_eta와 같은 stop_id로
  // 계산해 내려준다. 없으면(구형 캐시 등) 표기를 생략한다(모르는 것을 지어내지 않는다).
  const stopName = histData?.stop_name || null

  // ── 상태 2: 실시간 ETA 있음 — 2열 고정 그리드 ──
  if (realtimeEta?.primary) {
    const primary = realtimeEta.primary
    const secondary = realtimeEta.secondary ?? null
    const primaryLabel = etaLabel(primary.arrive_in_seconds) ?? '정보 없음'
    const secondaryLabel = secondary ? etaLabel(secondary.arrive_in_seconds) : null

    // 둘째 차 정보가 없으면 시간표 기준 다음 출발로 보강한다(가능하면 시각표
    // 우선 — 결함 #30 "이후 정보 없음보다 시간표 기준이 낫다").
    const fallbackNext = !secondary ? nextScheduled : null

    return (
      <div
        className="bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <span className="flex items-center gap-1.5 text-caption font-semibold tracking-[.04em] text-accent-ink dark:text-accent uppercase mb-1">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-accent animate-dot-blink" />
              실시간
              {stopName && (
                <span className="normal-case font-medium text-mute dark:text-mute">
                  · {stopName} 기준
                </span>
              )}
            </span>
            <span className={[
              'block text-eta-mob font-bold leading-tight tabular-nums',
              isImminent(primary.arrive_in_seconds) ? 'text-imminent' : 'text-ink dark:text-ink',
            ].join(' ')}>
              {primaryLabel}
            </span>
            {primary.arrive_at_hhmm && (
              <span className="block text-caption font-semibold text-mute dark:text-mute mt-0.5">
                {primary.arrive_at_hhmm} 도착
              </span>
            )}
          </div>

          <div className="min-w-0 pl-3 border-l border-accent/20 dark:border-accent/25">
            <span className="block text-caption font-semibold text-mute dark:text-mute mb-1">
              다음 차
            </span>
            {secondaryLabel ? (
              <>
                <span className="block text-eta-sm font-bold text-ink dark:text-ink leading-tight tabular-nums">
                  {secondaryLabel}
                </span>
                {secondary?.arrive_at_hhmm && (
                  <span className="block text-caption font-semibold text-mute dark:text-mute mt-0.5">
                    {secondary.arrive_at_hhmm} 도착
                  </span>
                )}
              </>
            ) : fallbackNext ? (
              <>
                <span className="block text-eta-sm font-bold text-ink dark:text-ink leading-tight tabular-nums">
                  {fallbackNext.depart_at}
                </span>
                <span className="block text-caption font-semibold text-mute dark:text-mute mt-0.5">
                  시간표 기준 출발
                </span>
              </>
            ) : (
              <span className="block text-body font-semibold text-mute dark:text-mute">
                이후 정보 없음
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── 상태 3: 실시간은 없지만 시간표가 있음 — 시간표 기준 다음 출발을 크게 ──
  if (nextScheduled) {
    return (
      <div className="bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3" role="status">
        <span className="block text-caption font-semibold tracking-[.04em] text-accent-ink dark:text-accent uppercase mb-1">
          다음 출발 (시간표 기준)
        </span>
        <span className="block text-eta-mob font-bold leading-tight tabular-nums text-ink dark:text-ink">
          {nextScheduled.depart_at}
        </span>
        <span className="block text-caption font-semibold text-mute dark:text-mute mt-0.5">
          이 노선은 실시간 위치 신호가 없어 시간표 기준으로 안내해요
        </span>
      </div>
    )
  }

  // ── 상태 4: 실시간도 시간표도 없음 — 모순 없는 한 문장 안내 ──
  return (
    <div className="bg-accent-bg border border-accent/25 dark:border-accent/35 rounded-card px-4 py-3" role="status">
      <span className="block text-body font-semibold text-ink dark:text-ink leading-snug">
        이 노선은 정해진 시간표 없이 수시 운행해요
      </span>
      <span className="block text-caption font-semibold text-mute dark:text-mute mt-1">
        실시간 신호가 잡히면 여기에 표시돼요
      </span>
    </div>
  )
}
