import Card from '../ui/Card.jsx'
import RouteBadge from '../ui/RouteBadge.jsx'
import StatusChip from '../ui/StatusChip.jsx'
import LastBusBanner from '../bus/LastBusBanner.jsx'
import { formatEta, formatHHMM } from '../../utils/eta.js'
import { labelFromLevel } from '../../utils/crowdingLevel'
import { useNow } from '../../hooks/useNow'

// 라벨은 utils/crowdingLevel 단일 출처를 쓴다 — 예전엔 이 표와 BusPanel.CROWDED_META가
// 따로 있어 등급 4가 화면마다 "매우혼잡"/"혼잡"으로 갈렸다.
function crowdedChip(level, estimated) {
  const label = labelFromLevel(level, { estimated })
  if (!label) return null
  return { kind: level >= 3 ? 'crowded' : 'ease', label }
}

// 칩 상한 — TransitCard(ui/TransitCard.jsx)의 VISIBLE_CHIP_MAX와 같은 규칙: 보이는
// 것 2개 + "+N". ArrivalRow는 즐겨찾기·지도 마커 시트에서 재사용되는 별도 카드라
// TransitCard의 칩 배열을 그대로 가져다 쓸 수 없어 여기 로컬로 둔다.
const VISIBLE_CHIP_MAX = 2

export default function ArrivalRow({
  route,
  routeNumber,
  direction,
  subdirection = null,
  minutes,
  extraMinutes = [],
  isUrgent,
  imminentLabel = null,
  lastTrain = false,
  returnTrip = false,
  status = null,
  onClick,
  rightAddon = null,
  crowded = 0,
  crowdedEstimated = false,
  isRealtime = false,
  selectedStation = null,
  // 오늘 시간표(있으면) — 막차 30분 이내일 때만 행 위에 컴팩트 배너를 얹는다.
  // 없으면(null) 아무것도 렌더하지 않는다. LastBusBanner가 자체 30분 판정을 한다.
  lastBusEntries = null,
  // routeColor prop 수신은 하지만 사용하지 않음 (RouteBadge가 내부에서 색 결정)
  // eslint-disable-next-line no-unused-vars
  routeColor,
  // 노선 종류 글리프('bus'|'subway'|'shuttle') — 타일 위에 얹는다. 이 컴포넌트는
  // 버스·지하철·셔틀 즐겨찾기가 공유하는데 호출부가 아직 종류를 넘기지 않으면
  // 글리프 없이 번호만 보여준다(TransitCard의 badge.mode와 동일한 폴백 규칙).
  mode,
}) {
  const minsArr = Array.isArray(minutes)
    ? minutes
    : minutes != null && Number.isFinite(minutes)
      ? [minutes, ...extraMinutes]
      : extraMinutes
  const first = minsArr[0]
  const rest = minsArr.slice(1, 3)
  const hasFirst = first != null && Number.isFinite(first)
  const urgent = isUrgent ?? (!!imminentLabel || (hasFirst && first <= 3))

  const badgeRoute = route ?? routeNumber ?? ''

  // ETA 계산: formatEta를 활용 (seconds로 변환)
  const firstSec = hasFirst ? first * 60 : null
  const etaResult = imminentLabel
    ? { text: imminentLabel, tone: 'imminent' }
    : firstSec == null && isRealtime
      ? { text: '실시간 준비 중', tone: 'none' }
      : formatEta(firstSec)

  // 시안 "도착 행 해부" — ETA는 상대시간(text-eta-num, 크게)이 주인공이고 그 아래
  // 절대시각(text-caption, 작게)을 병기한다. 지금까지는 상대시간만 있었다.
  // formatEta가 이미 60분 초과일 때 절대시각으로 전환하므로, 그 경우(tone==='normal'
  // 인데 text가 "N분" 형태가 아님)까지 다시 절대시각을 붙이면 같은 정보가 중복된다.
  // 렌더 중 Date.now() 를 부르면 순수하지 않다(react-hooks/purity). 목록 안에서
  // 여러 행이 같이 그려지므로 1분 틱이면 충분하다.
  const nowMs = useNow(60_000)
  const absoluteTimeText =
    firstSec != null && etaResult.tone === 'normal' && /분$/.test(etaResult.text)
      ? formatHHMM(nowMs + firstSec * 1000)
      : null

  // 보조 ETA (다음 차) — 절대시각과는 별개 줄. 둘 다 있으면 절대시각을 먼저(위),
  // 다음 차 분을 그 아래에 둔다(둘 다 "지금 이 순간 기준" 정보라 시간 순서로 읽힌다).
  const secondMin = rest[0]
  const secondEtaText =
    secondMin != null && Number.isFinite(secondMin)
      ? formatEta(secondMin * 60).text
      : null

  // direction / subdirection 표시 텍스트 결정
  // direction이 없으면 본문에 방향 표시 없음 (노선번호 중복 방지)
  const mainText = subdirection != null ? direction : direction ?? null
  const subText = subdirection != null ? subdirection : null

  const crowdedMeta = crowdedChip(crowded, crowdedEstimated)

  // 칩 상한(TransitCard와 동일 규칙) — 실시간·혼잡 칩이 데이터가 있는데도 안 뜨는
  // 문제가 있었다(실시간 칩 자체가 아예 연결돼 있지 않았다). 우선순위는 TransitCard와
  // 같은 실시간 → 혼잡 → 기타(막차/회차탑승) 순.
  const chipDefs = []
  if (isRealtime) chipDefs.push({ key: 'realtime', node: <StatusChip kind="realtime">실시간</StatusChip> })
  if (crowdedMeta) chipDefs.push({ key: 'crowded', node: <StatusChip kind={crowdedMeta.kind}>{crowdedMeta.label}</StatusChip> })
  if (lastTrain) chipDefs.push({ key: 'last', node: <StatusChip kind="last">막차</StatusChip> })
  if (returnTrip) chipDefs.push({ key: 'return', node: <StatusChip kind="last">회차탑승</StatusChip> })
  const chipOverflow = Math.max(0, chipDefs.length - VISIBLE_CHIP_MAX)
  const visibleChipDefs = chipOverflow > 0
    ? [...chipDefs.slice(0, VISIBLE_CHIP_MAX), { key: 'overflow', node: <StatusChip kind="beta">{`+${chipOverflow}`}</StatusChip> }]
    : chipDefs

  // onClick이 없고 routeNumber가 있으면 /route/bus:{routeNumber}?stop={station}로 네비게이트
  function handleClick() {
    if (onClick) {
      onClick()
      return
    }
    const rn = route ?? routeNumber
    if (rn) {
      const routeId = `bus:${rn}`
      const stopQuery = selectedStation
        ? `?stop=${encodeURIComponent(selectedStation)}`
        : ''
      const url = `/route/${routeId}${stopQuery}`
      window.history.pushState({ routeId }, '', url)
      window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
    }
  }

  return (
    <>
      {lastBusEntries && (
        <LastBusBanner
          entries={lastBusEntries}
          routeLabel={badgeRoute}
          compact
          className="mb-1.5"
        />
      )}
      {/* rightAddon 에는 즐겨찾기 편집 메뉴처럼 자체 버튼이 들어온다. 바깥을
          button 으로 감싸면 button 안에 button 이 중첩돼 유효하지 않은 HTML 이
          되고(브라우저가 콘솔 경고를 낸다) 키보드 포커스 순서도 어긋난다.
          div[role=button] + 키보드 핸들러로 바꿔 중첩을 없앤다. */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick(e)
          }
        }}
        data-urgent={urgent ? 'true' : 'false'}
        className="w-full text-left min-h-[44px] cursor-pointer"
      >
        <Card
          state={urgent ? 'imminent' : 'default'}
          interactive
          as="div"
        >
          <div className="flex items-center gap-3">
            {/* 좌: 노선 타일(56px, 시안2 해부도 1번째 자리) */}
            <RouteBadge route={badgeRoute} variant="tile" mode={mode} />

            {/* 중앙: 방향/출발지 정보 */}
            <div className="flex-1 min-w-0">
              {mainText && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-list-nm text-ink truncate">
                    {mainText}
                  </span>
                  {status === 'ok' && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--state-ok)' }}
                    />
                  )}
                  {status === 'warn' && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--state-warn)' }}
                    />
                  )}
                  {status === 'bad' && (
                    <span
                      aria-hidden="true"
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--state-bad)' }}
                    />
                  )}
                  {rightAddon}
                  {visibleChipDefs.map((chip) => (
                    <span key={chip.key}>{chip.node}</span>
                  ))}
                </div>
              )}
              {!mainText && (rightAddon || visibleChipDefs.length > 0) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {rightAddon}
                  {visibleChipDefs.map((chip) => (
                    <span key={chip.key}>{chip.node}</span>
                  ))}
                </div>
              )}
              {subText && (
                <div className="text-caption text-mute truncate mt-0.5">
                  {subText}
                </div>
              )}
            </div>

            {/* 우: ETA(3번째 자리) — 상대시간(text-eta-num) 크게, 절대/보조 정보는 캡션으로 아래 */}
            <div
              className="flex-shrink-0 text-right tabular-nums"
            >
              <div
                className={
                  etaResult.tone === 'none'
                    ? 'text-body text-mute font-bold whitespace-nowrap'
                    : urgent || etaResult.tone === 'imminent'
                      ? 'text-eta-num text-imminent'
                      : 'text-eta-num text-ink'
                }
              >
                {etaResult.text}
              </div>
              {absoluteTimeText && (
                <div className="text-caption text-mute mt-0.5 whitespace-nowrap">
                  {absoluteTimeText}
                </div>
              )}
              {secondEtaText && (
                <div className="text-caption text-mute mt-0.5 whitespace-nowrap">
                  {secondEtaText}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}
