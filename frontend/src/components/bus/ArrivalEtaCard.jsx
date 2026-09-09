/**
 * ArrivalEtaCard — 노선 상세 페이지 ① 도착 카드.
 *
 * 이 파일은 이제 해부도를 직접 그리지 않는다. 어떤 상태인지만 판정해서 정본
 * TransitCard(size='lg')에 넘긴다 — 예전에는 2열 분할에 26px·20px 두 크기의
 * ETA 숫자를 자체 마크업으로 그려, 같은 앱 안에 도착 카드 해부도가 하나 더
 * 있는 셈이었다.
 *
 * 상태 네 가지를 이 컴포넌트 하나가 책임진다.
 *  1) 로딩 중            — 실제 카드와 같은 셸의 자리표시자(레이아웃 시프트 0)
 *  2) realtime_eta 있음   — 실시간 칩 + 상대시간. 다음 차가 없으면 시간표 기준
 *                          다음 출발(nextScheduled)로 보조 줄을 채운다.
 *  3) realtime_eta 없고 시간표만 있음
 *                          — "실시간 신호가 없다"는 모순 카피 대신 시간표 기준
 *                          다음 출발을 크게 보여주고, 이유는 카드 아래 한 줄로.
 *  4) 둘 다 없음          — 카드를 그리지 않고 한 문장만 안내한다.
 *
 * 과거 도착 기록 진입 링크는 이 카드 안에 두지 않는다 — ⑤ 섹션이 페이지에 항상
 * 있어 중복 링크가 필요 없다.
 *
 * "초 → 표시 문자열" 변환과 임박 판정은 utils/eta.js에 위임한다.
 *
 * 승차 정류장 표기: 3401처럼 등록된 탑승 정류장이 2곳 이상인 노선은 이 ETA가
 * 어느 정류장 기준인지 말하지 않으면 승차 지점을 헷갈릴 수 있다. 백엔드
 * /bus/history-preview 응답의 stop_name(서버가 실시간 ETA를 그 정류장으로
 * 한정해 계산한다)을 부제로 붙인다.
 */
import TransitCard from '../ui/TransitCard'
import { SkeletonArrivalCard } from '../common/Skeleton'
import { formatEta, isImminent } from '../../utils/eta'

// arrive_in_seconds → 표시 문구. null이면 카드 문구는 '정보 없음'.
function etaLabel(sec) {
  if (sec == null) return null
  return formatEta(sec).text
}

export default function ArrivalEtaCard({
  histData,
  histLoading,
  nextScheduled,
  routeNumber = '',
  directionName = null,
}) {
  if (histLoading) {
    return (
      <div role="status" aria-live="polite">
        <span className="sr-only">실시간 도착 정보를 가져오는 중이에요</span>
        <SkeletonArrivalCard />
      </div>
    )
  }

  const realtimeEta = histData?.realtime_eta ?? null
  // 이 ETA가 기준으로 삼은 승차 정류장 — 백엔드가 realtime_eta와 같은 stop_id로
  // 계산해 내려준다. 없으면(구형 캐시 등) 표기를 생략한다(모르는 것을 지어내지 않는다).
  const stopName = histData?.stop_name || null
  const badge = { label: routeNumber, mode: 'bus' }

  // ── 상태 2: 실시간 ETA 있음 ──
  if (realtimeEta?.primary) {
    const primary = realtimeEta.primary
    const secondary = realtimeEta.secondary ?? null
    const secondaryLabel = secondary ? etaLabel(secondary.arrive_in_seconds) : null

    // 둘째 차 정보가 없으면 시간표 기준 다음 출발로 보강한다.
    const nextText = secondaryLabel
      ? `다음 ${secondaryLabel}${secondary?.arrive_at_hhmm ? ` (${secondary.arrive_at_hhmm})` : ''}`
      : nextScheduled
        ? `다음 ${nextScheduled.depart_at} 출발`
        : '이후 정보 없음'
    const arriveAtText = primary.arrive_at_hhmm ? `${primary.arrive_at_hhmm} 도착` : null

    return (
      <div role="status" aria-live="polite">
        <TransitCard
          size="lg"
          badge={badge}
          title={directionName || '도착 예정'}
          subtitle={stopName ? `${stopName} 기준` : undefined}
          chips={[{ label: '실시간', tone: 'realtime' }]}
          eta={{
            primary: {
              text: etaLabel(primary.arrive_in_seconds) ?? '정보 없음',
              tone: isImminent(primary.arrive_in_seconds) ? 'imminent' : 'default',
            },
            secondary: arriveAtText
              ? { text: arriveAtText, extra: nextText }
              : { text: nextText },
          }}
        />
      </div>
    )
  }

  // ── 상태 3: 실시간은 없지만 시간표가 있음 ──
  if (nextScheduled) {
    return (
      <div role="status">
        <TransitCard
          size="lg"
          badge={badge}
          title={directionName || '다음 출발'}
          chips={[{ label: '시간표', tone: 'neutral' }]}
          eta={{
            primary: { text: nextScheduled.depart_at, tone: 'default' },
            secondary: { text: '다음 출발 (시간표 기준)' },
          }}
        />
        <p className="mt-1.5 px-1 text-caption font-semibold text-mute">
          이 노선은 실시간 위치 신호가 없어 시간표 기준으로 안내해요
        </p>
      </div>
    )
  }

  // ── 상태 4: 실시간도 시간표도 없음 — 카드 없이 한 문장 ──
  return (
    <div role="status" className="px-1">
      <p className="text-body font-semibold text-ink leading-snug">
        이 노선은 정해진 시간표 없이 수시 운행해요
      </p>
      <p className="mt-1 text-caption font-semibold text-mute">
        실시간 신호가 잡히면 여기에 표시돼요
      </p>
    </div>
  )
}
