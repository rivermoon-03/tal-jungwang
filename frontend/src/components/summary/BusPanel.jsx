import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import {
  useBusArrivals,
  useBusRoutesByCategory,
  useBusTimetable,
} from '../../hooks/useBus'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import { SkeletonArrivalCard } from '../common/Skeleton'
import ErrorState from '../ui/ErrorState'
import StatusChip from '../ui/StatusChip.jsx'
import TransitCard from '../ui/TransitCard.jsx'
import { formatEta } from '../../utils/eta'
import { splitFare, formatWon } from '../../utils/taxiSplit'
import { useTrafficIncidents } from '../../hooks/useTrafficIncidents'
import { useTaxiDestinations } from '../../hooks/useTaxi'
import { labelFromLevel, toneFromLevel } from '../../utils/crowdingLevel'
import {
  arrivalEntryToSeconds,
  arrivalSecondsToMinutes,
  groupArrivalsByRoute,
  locationChipFromArrival,
  seatChipFromArrival,
} from '../../utils/busArrivalRows'
import { useActiveBusReports, busReportChipLabel } from '../../hooks/useBusReports'
import {
  getGbisStationId,
  getPerRouteDisplay, getRoutesFor,
  getRouteDisplayConfig, getOriginLabel,
  getAllowedDirections,
  getRouteTitleAndVia,
} from '../dashboard/busStationConfig'

const DEFAULT_ROUTE_COLOR = '#64748B'
// 결함 #3 — "5분 이하"가 곧 도착 섹션 + 임박(색만) 톤의 기준. 기존 IMMINENT_THRESHOLD_SEC(60초,
// "곧 도착" 라벨 전환용)와는 별개 — 이 파일이 새로 정의하는 대시보드 카드 전용 규칙이다.
const SOON_THRESHOLD_SEC = 5 * 60

// B3 — ITS 돌발 유형 → 라벨. 백엔드가 사고·공사만 내려주지만, 유형이 늘어나도
// 여기 없는 값은 배너·칩 어디에도 그리지 않는다(모르는 유형으로 겁주지 않기).
const INCIDENT_TYPE_LABEL = { accident: '사고', construction: '공사' }

// B6 — 다음 첫차가 이 분 안이면 택시 승격 카드를 접는다. 첫차 임박 시엔 기존
// "오늘/내일 첫차" 정보가 주인공이다.
const TAXI_PROMO_FIRST_BUS_MIN = 60

function getCommuteGroup(station, category, routeNumber) {
  if (category === '등교') return station === '서울' ? 'from-seoul' : 'from-siheung-city-hall'
  if (station === '한국공학대') {
    return ['11-A', '20-1'].includes(routeNumber) ? 'to-jeongwang' : 'to-siheung-city-hall'
  }
  return 'to-seoul'
}

function openBusDetail(setDetailModal, { routeNumber, routeId = null, station, category, title }) {
  setDetailModal({
    type: 'bus',
    routeCode: routeNumber,
    routeId,
    category,
    commuteGroup: getCommuteGroup(station, category, routeNumber),
    title: title || `${routeNumber}번 버스`,
    favCode: `${category}:${routeNumber}`,
  })
}

/**
 * BusPanel — 결함 #3/#13/#16/#17/#27 리디자인.
 *
 * - 모든 카드를 TransitCard로 통일. title은 행선지 풀네임(getRouteTitleAndVia),
 *   출발지/탑승지는 subtitle 한 줄로("한국공대 출발"류 반복은 리스트 상단에서 하지 않고
 *   각 카드에 얹는다 — 정류장별로 노선마다 출발지가 다를 수 있어 카드 단위가 정확하다).
 * - 칩 순서 고정: 실시간 → 혼잡 → 경유.
 * - 임박(ETA≤5분)은 eta.primary.tone='imminent'(색만) — 카드 보더/배경은 그대로.
 * - 실시간 미연결(도착 데이터는 있지만 arrive_in_seconds가 없는) 노선은 "실시간 연결 중"
 *   칩 + 시간표 폴백 ETA로 "운행 중" 섹션에 유지된다.
 * - 섹션: 곧 도착(ETA≤5분) / 운행 중(ETA순) / 오늘 미운행 · N(접힘, 기본 접힘).
 */
export default function BusPanel() {
  const selectedBusStation = useAppStore((s) => s.selectedBusStation)
  const setDetailModal = useAppStore((s) => s.setDetailModal)
  const { direction: selectedBusDirection } = useEffectiveDirection()
  const gbisStationId = getGbisStationId(selectedBusStation)

  // gbis 정류장(한국공학대/이마트/시흥시청): arrivals API 통합 사용
  const arrivalsQuery = useBusArrivals(gbisStationId)

  // F6 — 이 정류장의 활성(30분) 만차·결행 제보 → 노선별 경고 칩
  const activeReportsQuery = useActiveBusReports(gbisStationId)
  const reportByRoute = useMemo(() => {
    const map = {}
    for (const item of activeReportsQuery.data?.items ?? []) {
      if (!map[item.route_no]) map[item.route_no] = item
    }
    return map
  }, [activeReportsQuery.data])

  // B3 — 통학축 돌발(사고·공사). 저하·미승인 시 빈 배열 → 배너·칩 어디에도 안 그린다.
  const { incidents } = useTrafficIncidents()
  const incident = useMemo(
    () => incidents.find((i) => INCIDENT_TYPE_LABEL[i.type]) ?? null,
    [incidents]
  )

  // 서울 정류장: 기존 whitelist 방식 유지
  const isSeoulStation = gbisStationId === null
  const allowedRouteNumbers = useMemo(
    () => new Set(getRoutesFor(selectedBusStation, selectedBusDirection)),
    [selectedBusStation, selectedBusDirection]
  )
  const routesQuery = useBusRoutesByCategory(isSeoulStation ? selectedBusDirection : null)
  const seoulRoutes = useMemo(
    () => (routesQuery.data ?? []).filter((r) => allowedRouteNumbers.has(r.route_number)),
    [routesQuery.data, allowedRouteNumbers]
  )

  if (isSeoulStation) {
    return (
      <div className="space-y-2">
        <IncidentBanner incident={incident} />
        {routesQuery.loading && <SkeletonArrivalCard />}
        {routesQuery.error && !routesQuery.loading && (
          <ErrorState message="노선 정보 오류" onRetry={routesQuery.refetch} className="py-4" />
        )}
        {!routesQuery.loading && seoulRoutes.length === 0 && (
          <div className="text-caption text-mute py-6 text-center">노선이 없습니다</div>
        )}
        {seoulRoutes.length > 0 && (
          <h3 className="text-[12px] font-bold text-mute">운행 중</h3>
        )}
        {seoulRoutes.map((route) => (
          <SeoulRouteCard
            key={route.route_id}
            route={route}
            selectedBusStation={selectedBusStation}
            selectedBusDirection={selectedBusDirection}
            onOpenDetail={setDetailModal}
          />
        ))}
      </div>
    )
  }

  // gbis 정류장: arrivals 통합 렌더링
  if (arrivalsQuery.loading) return <SkeletonArrivalCard />
  if (arrivalsQuery.error && !arrivalsQuery.data) {
    return <ErrorState message="버스 정보 오류" onRetry={arrivalsQuery.refetch} className="py-4" />
  }

  const arrivals = arrivalsQuery.data?.arrivals ?? []

  // 방향 필터: 선택 정류장의 허용 방향에 맞는 arrivals만 표시
  const allowedDirs = getAllowedDirections(selectedBusStation)
  const filteredArrivals = arrivals.filter(
    (a) => !a.category || allowedDirs.includes(a.category)
  )

  if (filteredArrivals.length === 0) {
    return (
      <div className="text-caption text-mute py-6 text-center">
        실시간 정보를 가져오는 중이에요. 잠시 후 다시 확인해 주세요.
      </div>
    )
  }

  const routeGroups = groupArrivalsByRoute(filteredArrivals)

  // 실시간 ETA가 있는 그룹 / 없는 그룹(실시간 미연결 → 시간표 폴백) / 운행 시간대
  // 밖인 그룹으로 분리. 세 번째가 없던 시절엔 막차가 끊긴 노선도 "실시간 연결 중 ·
  // 잠시 후 다시 확인"으로 떠서, 오지 않을 차를 기다리게 만들었다.
  const liveRows = []
  const fallbackGroups = []
  const sleepingGroups = []
  for (const group of routeGroups) {
    const a = group[0]
    const sec = arrivalEntryToSeconds(a)
    if (a.off_service) {
      sleepingGroups.push(group)
    } else if (sec == null && !a.is_tomorrow) {
      fallbackGroups.push(group)
    } else {
      liveRows.push(buildLiveRow(group, { station: selectedBusStation, direction: selectedBusDirection, onOpenDetail: setDetailModal, reportByRoute, incident }))
    }
  }

  const imminentRows = liveRows.filter((r) => r.sec <= SOON_THRESHOLD_SEC).sort((a, b) => a.sec - b.sec)
  const runningRows = liveRows.filter((r) => r.sec > SOON_THRESHOLD_SEC).sort((a, b) => a.sec - b.sec)

  // 정류장이 취급하는 노선 중 오늘 arrivals 응답에 아예 없는(완전 미운행) 노선.
  // 기준 목록은 백엔드 expected_routes(bus_information_sources 기반)다 — 프런트
  // busStationConfig 상수로 판단하면 DB·GBIS 개편과 조용히 어긋난다.
  const presentRouteNos = new Set(routeGroups.map((g) => g[0].route_no))
  const expectedRoutes = arrivalsQuery.data?.expected_routes ?? []
  const missingRoutes = expectedRoutes.filter((r) => !presentRouteNos.has(r.route_no))

  const hasRunning = runningRows.length > 0 || fallbackGroups.length > 0
  // 첫차 전(자정~새벽)과 막차 후는 둘 다 "지금 안 다닌다"지만 헤더로는 구분한다.
  const allEndedForToday = sleepingGroups.every((g) => g[0].next_first_day !== 'today')

  // B6 — 전 노선이 "오늘 운행 종료"일 때만 택시를 승격한다. 운행 중 노선이 하나라도
  // 있거나 첫차 전('지금은 운행 안 함')이면 기존 화면 그대로. 오늘 미운행 섹션
  // (missingRoutes)은 오늘 원래 안 다니는 노선이라 "지금 택시가 대안" 판정과 무관하다.
  // 첫차가 60분 안이면 카드도 접는다 — 그때는 첫차 정보가 주인공이다.
  const allEndedOnly =
    liveRows.length === 0 && fallbackGroups.length === 0 && sleepingGroups.length > 0 && allEndedForToday
  const firstBusMin = allEndedOnly ? firstBusMinutesAway(sleepingGroups) : null
  const showTaxiPromo = allEndedOnly && !(firstBusMin != null && firstBusMin <= TAXI_PROMO_FIRST_BUS_MIN)

  return (
    <div className="space-y-3">
      <IncidentBanner incident={incident} />

      {showTaxiPromo && <TaxiPromoCard />}

      {imminentRows.length > 0 && (
        <section>
          <h3 className="text-[12px] font-bold text-mute mb-1.5">곧 도착</h3>
          <div className="space-y-2">{imminentRows.map((r) => r.node)}</div>
        </section>
      )}

      {hasRunning && (
        <section>
          <h3 className="text-[12px] font-bold text-mute mb-1.5">운행 중</h3>
          <div className="space-y-2">
            {runningRows.map((r) => r.node)}
            {fallbackGroups.map((group) => (
              <BusFallbackCard
                key={group[0].route_no}
                arrival={group[0]}
                station={selectedBusStation}
                direction={selectedBusDirection}
                onOpenDetail={setDetailModal}
              />
            ))}
          </div>
        </section>
      )}

      {sleepingGroups.length > 0 && (
        <section>
          <h3 className="text-[12px] font-bold text-mute mb-1.5">
            {allEndedForToday ? '오늘 운행 종료' : '지금은 운행 안 함'}
          </h3>
          <div className="space-y-2">
            {sleepingGroups.map((group) => (
              <SleepingCard
                key={group[0].route_no}
                arrival={group[0]}
                station={selectedBusStation}
                direction={selectedBusDirection}
                onOpenDetail={setDetailModal}
              />
            ))}
          </div>
        </section>
      )}

      {missingRoutes.length > 0 && (
        <NotRunningSection
          routes={missingRoutes}
          station={selectedBusStation}
          direction={selectedBusDirection}
          onOpenDetail={setDetailModal}
        />
      )}

      {imminentRows.length === 0 && !hasRunning && sleepingGroups.length === 0 && missingRoutes.length === 0 && (
        <div className="text-caption text-mute py-6 text-center">
          실시간 정보를 가져오는 중이에요. 잠시 후 다시 확인해 주세요.
        </div>
      )}
    </div>
  )
}

/**
 * 카드 subtitle 로 쓸 승차 지점 문구.
 *
 * 백엔드가 `bus_information_sources`의 승차 라벨을 정규화해 내려주므로 그 값을 그대로
 * 쓴다("이마트 승차"). 시간표 화면과 같은 출처라 같은 노선을 다르게 설명하지 않는다.
 * 서울 정류장처럼 통학 맥락 source 가 없는 경로만 기존 상수로 폴백한다.
 */
function boardingLabel(arrival, station, direction) {
  if (arrival.boarding_label) return arrival.boarding_label
  const perRoute = getPerRouteDisplay(station)?.[arrival.route_no]
  return perRoute ? getOriginLabel(station, direction, perRoute.origin) : ''
}

/** 실시간 ETA가 확보된 그룹 하나 → {sec, node(TransitCard)}. */
function buildLiveRow(group, { station, direction, onOpenDetail, reportByRoute = {}, incident = null }) {
  const a = group[0]
  const a2 = group[1] ?? null
  const sec = arrivalEntryToSeconds(a)
  const sec2 = a2 ? arrivalEntryToSeconds(a2) : null
  const minutes2 = arrivalSecondsToMinutes(sec2)

  const cfg = getRouteDisplayConfig(a.route_no)
  const { title, viaChip } = getRouteTitleAndVia(a.route_no, a.category ?? direction, a.destination)
  const originText = boardingLabel(a, station, direction)

  // A1 — 광역버스는 혼잡도(재차 인원)보다 잔여좌석이 정확한 신호라 좌석 칩으로
  // 대체한다. remain_seat이 없거나(-1·구형 캐시) 비광역이면 기존 혼잡도 칩 유지.
  const seatChip = seatChipFromArrival(a, { isExpress: cfg?.category === 'express' })
  // A3 — GBIS locationNo(남은 정거장 수) ≥ 1 이면 거리감을 정거장 단위로 보여준다.
  const locationChip = locationChipFromArrival(a)
  // 라벨은 utils/crowdingLevel 단일 출처. 보정이 값을 올렸으면 "경험 기준"이 붙는다.
  const crowdedLabel = !seatChip && a.arrival_type === 'realtime'
    ? labelFromLevel(a.crowded, { estimated: a.crowded_estimated })
    : null

  // 칩 순서 정책: 실시간 → 혼잡/좌석 → (정거장) → (베타) → 제보 → (경로 돌발) → 경유
  const chips = []
  if (a.arrival_type === 'realtime') chips.push({ label: '실시간', tone: 'realtime' })
  if (seatChip) chips.push(seatChip)
  else if (crowdedLabel) chips.push({ label: crowdedLabel, tone: toneFromLevel(a.crowded) })
  if (locationChip) chips.push(locationChip)
  // 실시간 신규 기능 베타 정책 — 좌석·정거장 칩이 하나라도 보이면 베타 칩 1개만 단다
  if (seatChip || locationChip) chips.push({ label: '베타', tone: 'beta' })
  // F6 — 활성 만차·결행 제보 경고(혼잡 칩보다 구체적 정보라 경유 칩보다 앞)
  const report = reportByRoute[a.route_no]
  if (report) chips.push({ label: busReportChipLabel(report), tone: 'warn' })
  // B3 — 서울 방면 축에 돌발이 있으면 그 축을 타는 광역(express) 노선에만 경고 칩.
  // 시내·간선은 축을 안 타므로 붙이지 않는다(오탐 경고가 신뢰를 깎는다).
  if (incident && cfg?.category === 'express') {
    chips.push({ label: `경로 ${INCIDENT_TYPE_LABEL[incident.type]}`, tone: 'warn' })
  }
  if (viaChip) chips.push({ label: viaChip, tone: 'neutral' })

  const imminent = !a.is_tomorrow && sec != null && sec <= SOON_THRESHOLD_SEC
  const etaResult = a.is_tomorrow ? { text: '내일 첫차' } : formatEta(sec)

  return {
    sec: a.is_tomorrow ? Infinity : sec,
    node: (
      <TransitCard
        key={a.route_no}
        badge={{ label: a.route_no, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
        title={title}
        subtitle={originText || undefined}
        chips={chips}
        eta={{
          primary: { text: etaResult.text, tone: imminent ? 'imminent' : 'default' },
          secondary: minutes2 != null ? { text: `다음 ${minutes2}분` } : undefined,
        }}
        onClick={() => openBusDetail(onOpenDetail, {
          routeNumber: a.route_no,
          routeId: a.route_id ?? null,
          station,
          category: a.category ?? direction,
          title: `${a.route_no} · ${title}`,
        })}
      />
    ),
  }
}

/**
 * 서울 정류장(시간표 전용) 카드 — useBusTimetable을 노선별로 구독하는 서브컴포넌트.
 * 서울 정류장은 항상 등교 전용·실시간 없음이라 곧 도착/운행 중 구분 없이 한 목록에 둔다.
 */
function SeoulRouteCard({ route, selectedBusStation, selectedBusDirection, onOpenDetail }) {
  const { route_id, route_number } = route
  const timetable = useBusTimetable(route_id)

  if (timetable.loading) return <SkeletonArrivalCard />
  if (timetable.error && !timetable.data) {
    return <ErrorState message={`${route_number} 정보 오류`} onRetry={timetable.refetch} className="py-4" />
  }

  const entries = extractNext(timetable.data, 2)
  const nextEntry = entries[0] ?? null
  const secondEntry = entries[1] ?? null
  const nextSec = arrivalToSeconds(nextEntry)
  const secondMinutes = arrivalToMinutes(secondEntry)
  const imminent = nextSec != null && nextSec <= SOON_THRESHOLD_SEC

  const perRoute = getPerRouteDisplay(selectedBusStation)?.[route_number]
  const cfg = getRouteDisplayConfig(route_number)
  const { title, viaChip } = getRouteTitleAndVia(route_number, selectedBusDirection, route.direction_name)
  const originText = perRoute ? getOriginLabel(selectedBusStation, selectedBusDirection, perRoute.origin) : ''

  const etaResult = nextSec == null ? { text: '출발 정보 없음', tone: 'muted' } : formatEta(nextSec)

  return (
    <TransitCard
      badge={{ label: route_number, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={originText || undefined}
      chips={viaChip ? [{ label: viaChip, tone: 'neutral' }] : []}
      eta={{
        primary: { text: etaResult.text, tone: nextSec == null ? 'muted' : imminent ? 'imminent' : 'default' },
        secondary: secondMinutes != null ? { text: `다음 ${secondMinutes}분` } : undefined,
      }}
      onClick={() => openBusDetail(onOpenDetail, {
        routeNumber: route_number,
        routeId: route_id,
        station: selectedBusStation,
        category: selectedBusDirection,
        title: `${route_number} · ${title}`,
      })}
    />
  )
}

/**
 * 결함 #17 — 실시간 도착 데이터는 있지만(arrivals 응답에 항목 존재) 실시간 위치가
 * 아직 안 잡혀 arrive_in_seconds가 없는 노선. "실시간 준비 중" 대신 시간표 폴백:
 * 오늘 남은 시간표가 있으면 그 시각을, 없으면 안내 문구를 보여준다.
 *
 * 폴백 시각은 arrivals 응답의 depart_at을 그대로 쓴다. 그 승차점에 제품이 보장한
 * 출발 시간표가 있는지(`bus_information_sources`)는 서버가 판단하며, 클라이언트가
 * 노선번호로 다시 조회하면 source로 연결하지 않은 원본 시간표까지 끌어오게 된다.
 * 값이 비어도 카드는 상세로 진입 가능해야 한다(정보 부재 ≠ 상세 부재).
 */
/**
 * 운행 시간대 밖인 노선 카드. 목록에서 지우지 않는 이유: 막차가 끝난 걸 확인하러
 * 오거나 내일 첫차를 보러 오는 사람이 있다. 대신 달 + Zzz 로 상태를 먼저 말한다.
 */
function SleepingCard({ arrival, station, direction, onOpenDetail }) {
  const category = arrival.category ?? direction
  const cfg = getRouteDisplayConfig(arrival.route_no)
  const { title, viaChip } = getRouteTitleAndVia(arrival.route_no, category, arrival.destination)

  const dayWord = arrival.next_first_day === 'today' ? '오늘' : '내일'
  const firstLabel = arrival.next_first_at ? `${dayWord} 첫차 ${arrival.next_first_at}` : null

  return (
    <TransitCard
      badge={{ label: arrival.route_no, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={boardingLabel(arrival, station, direction) || undefined}
      sleeping={{ label: firstLabel }}
      chips={viaChip ? [{ label: viaChip, tone: 'neutral' }] : []}
      muted
      eta={{ primary: { text: arrival.next_first_day === 'today' ? '운행 전' : '운행 종료', tone: 'muted' } }}
      onClick={() => openBusDetail(onOpenDetail, {
        routeNumber: arrival.route_no,
        routeId: arrival.route_id ?? null,
        station,
        category,
        title: `${arrival.route_no} · ${title}`,
      })}
    />
  )
}

function BusFallbackCard({ arrival, station, direction, onOpenDetail }) {
  const category = arrival.category ?? direction
  const cfg = getRouteDisplayConfig(arrival.route_no)
  const { title, viaChip } = getRouteTitleAndVia(arrival.route_no, category, arrival.destination)

  const next = arrival.depart_at ?? null
  const chips = [{ label: '실시간 연결 중', tone: 'neutral' }]
  if (viaChip) chips.push({ label: viaChip, tone: 'neutral' })

  return (
    <TransitCard
      badge={{ label: arrival.route_no, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={boardingLabel(arrival, station, direction) || undefined}
      chips={chips}
      eta={
        next
          ? { primary: { text: `${next} 출발`, tone: 'default' }, secondary: { text: '시간표 기준' } }
          // 이 승차점에 시간표 자체가 없는 실시간 전용 노선이다. "출발 정보 없음"은
          // 시간표가 있는데 비어 보이게 하므로 도착 기준 문구를 쓴다.
          : { primary: { text: '현재 도착 정보 없음', tone: 'muted' }, secondary: { text: '잠시 후 다시 확인' } }
      }
      onClick={() => openBusDetail(onOpenDetail, {
        routeNumber: arrival.route_no,
        routeId: arrival.route_id ?? null,
        station,
        category,
        title: `${arrival.route_no} · ${title}`,
      })}
    />
  )
}

/** 결함 #27 — "오늘 미운행 · N" 접힘 섹션. 기본 접힘, 펼치면 노선별 muted 카드. */
function NotRunningSection({ routes, station, direction, onOpenDetail }) {
  const [open, setOpen] = useState(false)

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[12px] font-bold text-mute mb-1.5 pressable"
      >
        오늘 미운행 · {routes.length}
        <ChevronDown size={13} aria-hidden="true" className={`transition-transform duration-base ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2">
          {routes.map((route) => (
            <NotRunningCard
              key={route.route_no}
              route={route}
              station={station}
              direction={direction}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * 오늘 도착·출발 정보가 하나도 없는 노선. 여기서 노선번호로 시간표를 다시 조회하면
 * 제품이 승차 시간표로 연결하지 않은 원본 행(시흥1·시흥33)까지 "평일 첫차"로 나온다.
 * 운행 여부 판단은 시간표 화면으로 넘기고 목록에서는 상태만 말한다.
 */
function NotRunningCard({ route, station, direction, onOpenDetail }) {
  const routeNo = route.route_no
  const category = route.category ?? direction
  const cfg = getRouteDisplayConfig(routeNo)
  const { title } = getRouteTitleAndVia(routeNo, category, null)

  return (
    <TransitCard
      badge={{ label: routeNo, bgVar: cfg?.color ?? DEFAULT_ROUTE_COLOR }}
      title={title}
      subtitle={route.boarding_label || undefined}
      muted
      chips={[{ label: '오늘 미운행', tone: 'neutral' }]}
      eta={{
        primary: { text: '오늘 미운행', tone: 'muted' },
        secondary: { text: '운행일 확인' },
      }}
      onClick={() => openBusDetail(onOpenDetail, {
        routeNumber: routeNo,
        routeId: route.route_id ?? null,
        station,
        category,
        title: `${routeNo} · ${title}`,
      })}
    />
  )
}

/**
 * B3 — occurred_at(백엔드가 항상 KST tz-aware ISO로 내려줌) → "HH:MM".
 * Date로 파싱하면 기기 시간대로 다시 변환되므로 문자열에서 그대로 읽는다.
 */
function incidentHhmm(iso) {
  const m = /T(\d{2}:\d{2})/.exec(iso ?? '')
  return m ? m[1] : null
}

/**
 * B3 — 통학축 돌발 배너(베타). 인시던트가 없거나 API가 저하되면 null을 반환한다 —
 * 빈 상태 UI를 그리지 않는 게 규칙이다(배너·칩·네트워크 요청 외 사이드이펙트 금지).
 */
function IncidentBanner({ incident }) {
  if (!incident) return null
  const head = [incident.road_name, INCIDENT_TYPE_LABEL[incident.type]].filter(Boolean).join(' ')
  const hhmm = incidentHhmm(incident.occurred_at)
  return (
    <div className="flex items-center gap-1.5 rounded-card bg-imminent-bg px-3 py-2">
      {/* 구분자는 em-dash 대신 "·" — tokenRules.test.js c)가 UI 렌더 텍스트의 em-dash를 금지한다 */}
      <p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-snug text-imminent">
        ⚠ {head} · 서울 방면 광역버스 지연 가능{hhmm ? ` · ${hhmm} 확인` : ''}
      </p>
      <StatusChip kind="beta" className="shrink-0">베타</StatusChip>
    </div>
  )
}

/**
 * B6 — sleeping 그룹들의 다음 첫차까지 남은 분(최솟값). 판정 불가면 null.
 * next_first_day가 'today'가 아니면 내일 같은 시각으로 계산한다 — 자정 직전에
 * 내일 첫차가 60분 안으로 들어오는 케이스(예: 23:50에 00:30 첫차)를 놓치지 않기 위해.
 */
function firstBusMinutesAway(sleepingGroups, now = new Date()) {
  let min = null
  for (const group of sleepingGroups) {
    const a = group[0]
    if (!a.next_first_at) continue
    const [h, m] = a.next_first_at.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) continue
    const t = new Date(now)
    t.setHours(h, m, 0, 0)
    if (a.next_first_day !== 'today') t.setDate(t.getDate() + 1)
    const diff = (t.getTime() - now.getTime()) / 60000
    if (diff < 0) continue
    if (min == null || diff < min) min = diff
  }
  return min
}

/**
 * B6 — 심야 택시 승격 카드. 전 노선이 "오늘 운행 종료"일 때만 마운트되므로
 * 요금·시간 조회(useTaxiDestinations — 택시 탭과 같은 엔드포인트·프리셋)도
 * 그때만 나간다. 조회 실패 시 숫자 줄만 생략하고 버튼은 유지한다.
 */
function TaxiPromoCard() {
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const { destinations } = useTaxiDestinations()
  const jeongwang = destinations?.find((d) => d.id === 'jeongwang_station') ?? null
  const minutes = jeongwang?.duration_seconds != null
    ? Math.max(1, Math.round(jeongwang.duration_seconds / 60))
    : null
  const fee = jeongwang?.taxi_fee > 0 ? jeongwang.taxi_fee : null
  const half = splitFare(fee, 2)

  const parts = ['학교 정문 → 정왕역']
  if (minutes != null) parts.push(`약 ${minutes}분`)
  if (fee != null) parts.push(`약 ${fee.toLocaleString()}원`)

  return (
    <section className="bg-surface border border-line rounded-card p-3">
      <h3 className="text-[15px] font-bold text-ink">지금은 택시가 빨라요</h3>
      {parts.length > 1 && (
        <p className="mt-0.5 text-[12.5px] font-semibold text-mute tabular-nums">{parts.join(' · ')}</p>
      )}
      {half != null && (
        <p className="text-[12.5px] font-semibold text-mute tabular-nums">2명이 나누면 {formatWon(half)}</p>
      )}
      <div className="mt-2.5 flex items-center gap-1.5">
        <a
          href="https://t.kakao.com/launch"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-pill bg-accent-bg px-3 py-1.5 text-caption font-semibold text-accent-ink pressable"
        >
          카카오T 열기
        </a>
        <button
          type="button"
          onClick={() => setSelectedMode('taxi')}
          className="rounded-pill border border-line bg-surface-2 px-3 py-1.5 text-caption font-semibold text-ink pressable"
        >
          택시 탭 보기
        </button>
      </div>
      {/* 택시 탭(TaxiPanel)과 같은 고지 문구 — 두 화면이 같은 추정치를 다르게 설명하지 않는다 */}
      <p className="mt-2 text-[12px] font-medium text-mute">실제 요금·시간과 다를 수 있습니다</p>
    </section>
  )
}

function extractNext(data, n = 2) {
  if (!data) return []
  if (Array.isArray(data)) return data.slice(0, n)
  if (data.arrivals) return data.arrivals.slice(0, n)
  if (data.times) {
    const now = new Date()
    return data.times
      .filter((t) => {
        if (typeof t !== 'string') return false
        const [h, m] = t.split(':').map(Number)
        if (Number.isNaN(h) || Number.isNaN(m)) return false
        const d = new Date(now); d.setHours(h, m, 0, 0)
        const diff = d.getTime() - now.getTime()
        return diff >= 0 && diff <= 12 * 60 * 60 * 1000
      })
      .slice(0, n)
      .map((t) => ({ depart_at: t }))
  }
  return []
}

function arrivalToSeconds(entry) {
  if (!entry) return null
  if (entry.arrive_in_seconds != null) {
    return Math.max(0, entry.arrive_in_seconds)
  }
  if (entry.depart_at) {
    const [h, m] = entry.depart_at.split(':').map(Number)
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      const now = new Date()
      const t = new Date(now)
      t.setHours(h, m, 0, 0)
      const diff = Math.floor((t - now) / 1000)
      return diff >= 0 ? diff : null
    }
  }
  return null
}

function arrivalToMinutes(entry) {
  const sec = arrivalToSeconds(entry)
  return sec == null ? null : Math.max(0, Math.ceil(sec / 60))
}
