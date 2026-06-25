import Card from '../ui/Card.jsx'
import RouteBadge from '../ui/RouteBadge.jsx'
import StatusChip from '../ui/StatusChip.jsx'
import { formatEta } from '../../utils/eta.js'

const CROWDED_KIND = {
  1: { kind: 'ease', label: '여유' },
  2: { kind: 'ease', label: '보통' },
  3: { kind: 'crowded', label: '혼잡' },
  4: { kind: 'crowded', label: '매우혼잡' },
}

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
  isRealtime = false,
  selectedStation = null,
  // routeColor prop 수신은 하지만 사용하지 않음 (RouteBadge가 내부에서 색 결정)
  // eslint-disable-next-line no-unused-vars
  routeColor,
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

  // 보조 ETA (다음 차)
  const secondMin = rest[0]
  const secondEtaText =
    secondMin != null && Number.isFinite(secondMin)
      ? formatEta(secondMin * 60).text
      : null

  // direction / subdirection 표시 텍스트 결정
  // direction이 없으면 본문에 방향 표시 없음 (노선번호 중복 방지)
  const mainText = subdirection != null ? direction : direction ?? null
  const subText = subdirection != null ? subdirection : null

  const crowdedMeta = CROWDED_KIND[crowded] ?? null

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
    <button
      type="button"
      onClick={handleClick}
      data-urgent={urgent ? 'true' : 'false'}
      className="w-full text-left min-h-[44px]"
      style={{ display: 'block', background: 'none', border: 'none', padding: 0 }}
    >
      <Card
        state={urgent ? 'imminent' : 'default'}
        interactive
        as="div"
      >
        <div className="flex items-center gap-3">
          {/* 좌상단: 노선번호 뱃지 */}
          <RouteBadge route={badgeRoute} variant="solid" />

          {/* 중앙: 방향/출발지 정보 */}
          <div className="flex-1 min-w-0">
            {mainText && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-body text-ink font-bold truncate">
                  {mainText}
                </span>
                {lastTrain && (
                  <StatusChip kind="last">막차</StatusChip>
                )}
                {returnTrip && (
                  <StatusChip kind="last">회차탑승</StatusChip>
                )}
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
                {crowdedMeta && (
                  <StatusChip kind={crowdedMeta.kind}>{crowdedMeta.label}</StatusChip>
                )}
              </div>
            )}
            {!mainText && (lastTrain || returnTrip || rightAddon || crowdedMeta) && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {lastTrain && <StatusChip kind="last">막차</StatusChip>}
                {returnTrip && <StatusChip kind="last">회차탑승</StatusChip>}
                {rightAddon}
                {crowdedMeta && (
                  <StatusChip kind={crowdedMeta.kind}>{crowdedMeta.label}</StatusChip>
                )}
              </div>
            )}
            {subText && (
              <div className="text-label text-mute truncate mt-0.5">
                {subText}
              </div>
            )}
          </div>

          {/* 우측: ETA */}
          <div
            className="flex-shrink-0 text-right tabular-nums"
          >
            <div
              className={
                etaResult.tone === 'none'
                  ? 'text-body text-mute font-bold whitespace-nowrap'
                  : urgent || etaResult.tone === 'imminent'
                    ? 'text-eta text-imminent font-black leading-none'
                    : 'text-eta text-ink font-black leading-none'
              }
            >
              {etaResult.text}
            </div>
            {secondEtaText && (
              <div className="text-caption text-mute mt-0.5 whitespace-nowrap">
                {secondEtaText}
              </div>
            )}
          </div>
        </div>
      </Card>
    </button>
  )
}
