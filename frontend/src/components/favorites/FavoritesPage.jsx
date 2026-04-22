/**
 * FavoritesPage — 즐겨찾기 탭 (라이브 타일)
 *
 * 즐겨찾기 대상: routes + stations (Zustand persist)
 * 라이브 데이터: useBusArrivals로 정류장 도착 정보 가져옴 (shuttle/subway 다음 열차도)
 * TODO: 즐겨찾기 항목마다 개별 API 호출 대신 batch 엔드포인트 추가 시 교체
 */
import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import FavoritesList from './FavoritesList'
import FavoritesTimeline from './FavoritesTimeline'
import EmptyState from '../common/EmptyState'
import SegmentTabs from '../common/SegmentTabs'
import PageHeader from '../layout/PageHeader'
import ScheduleDetailModal from '../schedule/ScheduleDetailModal'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'
import { useBusTimetableByRoute, useBusArrivals, useBusStations, useBusRoutesByCategory } from '../../hooks/useBus'

// 스케줄 페이지가 생성하는 새 형식 버스 favKey: "등교:X" / "하교:X" / "기타:X"
const BUS_CATEGORY_PREFIXES = ['등교:', '하교:', '기타:']
function parseBusFavKey(favKey) {
  if (typeof favKey !== 'string') return null
  for (const p of BUS_CATEGORY_PREFIXES) {
    if (favKey.startsWith(p)) {
      return { category: p.slice(0, -1), routeNumber: favKey.slice(p.length) }
    }
  }
  return null
}

// favKey → 등교/하교 분류
const FAV_KEY_COMMUTE = {
  'shuttle:등교':         '등교',
  'shuttle:하교':         '하교',
  '20-1':                 '하교',  // 본캠 출발
  '시흥33':               '하교',  // 본캠 출발
  '시흥1':                '하교',  // 이마트 출발 (서울/신천)
  '버스 - 학교행:3400':   '등교',
  '버스 - 학교행:6502':   '등교',
  '버스 - 서울행:3400':   '하교',
  '버스 - 서울행:6502':   '하교',
}

// 새 형식 favKey → 기존 useBusMinutesByFavKey 결과의 레거시 키
// (현재 분 계산이 지원되는 7개 노선). 매핑 없는 버스는 minutes=null로 표시.
const NEW_TO_LEGACY_MIN_KEY = {
  '하교:20-1':   '20-1',
  '하교:시흥33': '시흥33',
  '하교:시흥1':  '시흥1',
  '하교:3400':   '버스 - 서울행:3400',
  '하교:6502':   '버스 - 서울행:6502',
  '등교:3400':   '버스 - 학교행:3400',
  '등교:6502':   '버스 - 학교행:6502',
}

// subway suffix → 등교/하교 (학교 방향=등교, 그 외=하교)
const SUBWAY_DIR_COMMUTE = {
  up:         '등교',  // 수인분당 왕십리행 — 학교 통학용
  down:       '하교',  // 수인분당 인천행
  line4_up:   '등교',
  line4_down: '하교',
  choji_up:   '등교',
  choji_dn:   '하교',
  siheung_up: '등교',
  siheung_dn: '하교',
}

function classifyCommute(favKey) {
  if (!favKey) return '하교'
  if (FAV_KEY_COMMUTE[favKey]) return FAV_KEY_COMMUTE[favKey]
  const busParsed = parseBusFavKey(favKey)
  if (busParsed) return busParsed.category === '등교' ? '등교' : '하교'
  if (favKey.startsWith('subway:')) {
    const parts = favKey.split(':')
    const station = parts[1] ?? '정왕'
    const legacyKey = station === '초지' ? 'choji_up' : station === '시흥시청' ? 'siheung_up' : 'up'
    const dir = parts[2] ?? legacyKey
    return SUBWAY_DIR_COMMUTE[dir] ?? '하교'
  }
  return '하교'
}

// 버스 노선별 다음 출발까지 남은 분 (favKey → minutes)
function useBusMinutesByFavKey() {
  // 실시간 (GBIS) — 20-1, 시흥33 (본캠), 시흥1 (이마트)
  const realtimeHanguk = useBusArrivals('224000639')
  const realtimeEmart  = useBusArrivals('224000513')

  // 3400/6502 정류장별 시간표
  const { data: stationsData } = useBusStations()
  const byName = (name) => stationsData?.find((s) => s.name === name)?.station_id ?? null
  const sihwa   = byName('시화')
  const emart   = byName('이마트')
  const gangnam = byName('강남역')
  const sadang  = byName('사당역')

  const r3400Seoul  = useBusTimetableByRoute('3400', { stopId: sihwa   ?? undefined, requireStopId: true })
  const r3400School = useBusTimetableByRoute('3400', { stopId: gangnam ?? undefined, requireStopId: true })
  const r6502Seoul  = useBusTimetableByRoute('6502', { stopId: emart   ?? undefined, requireStopId: true })
  const r6502School = useBusTimetableByRoute('6502', { stopId: sadang  ?? undefined, requireStopId: true })

  return useMemo(() => {
    const now = new Date()
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    function firstFutureMin(times) {
      if (!Array.isArray(times)) return null
      const next = times.find((t) => t >= nowStr)
      if (!next) return null
      const [h, m] = next.split(':').map(Number)
      const d = new Date()
      d.setHours(h, m, 0, 0)
      return Math.max(0, Math.round((d - new Date()) / 60000))
    }
    function realtimeMin(arrivals, routeNo) {
      const list = arrivals?.arrivals
      if (!list?.length) return null
      const a = list.find((x) => x.route_no === routeNo)
      if (!a || a.arrive_in_seconds == null) return null
      return Math.max(0, Math.round(a.arrive_in_seconds / 60))
    }
    return {
      '20-1':                realtimeMin(realtimeHanguk.data, '20-1'),
      '시흥33':              realtimeMin(realtimeHanguk.data, '시흥33'),
      '시흥1':               realtimeMin(realtimeEmart.data,  '시흥1'),
      '버스 - 서울행:3400':  firstFutureMin(r3400Seoul.data?.times),
      '버스 - 서울행:6502':  firstFutureMin(r6502Seoul.data?.times),
      '버스 - 학교행:3400':  firstFutureMin(r3400School.data?.times),
      '버스 - 학교행:6502':  firstFutureMin(r6502School.data?.times),
    }
  }, [realtimeHanguk.data, realtimeEmart.data, r3400Seoul.data, r6502Seoul.data, r3400School.data, r6502School.data])
}

// favKey → 표시 메타
const ROUTE_STATION_MAP = {
  '20-1':   { stationId: '224000639', stationName: '본캠', type: 'bus', routeCode: '20-1' },
  '시흥33': { stationId: '224000639', stationName: '본캠', type: 'bus', routeCode: '시흥33' },
  '시흥1':  { stationId: '224000513', stationName: '이마트',          type: 'bus', routeCode: '시흥1' },
  '버스 - 서울행:3400':  { stationName: '시화',   type: 'bus', routeCode: '3400', endpoints: '서울행' },
  '버스 - 서울행:6502':  { stationName: '이마트', type: 'bus', routeCode: '6502', endpoints: '서울행' },
  '버스 - 학교행:3400':  { stationName: '강남역', type: 'bus', routeCode: '3400', endpoints: '학교행' },
  '버스 - 학교행:6502':  { stationName: '사당역', type: 'bus', routeCode: '6502', endpoints: '학교행' },
}

// subway direction key → 노선명 + 행선지 라벨 + 노선색
const SUBWAY_KEY_INFO = {
  up:         { line: '수인분당선', label: '왕십리행', color: '#F5A623' },
  down:       { line: '수인분당선', label: '인천행',   color: '#F5A623' },
  line4_up:   { line: '4호선',     label: '상행',     color: '#1B5FAD' },
  line4_down: { line: '4호선',     label: '하행',     color: '#1B5FAD' },
  choji_up:   { line: '서해선',     label: '소사행',   color: '#75bf43' },
  choji_dn:   { line: '서해선',     label: '원시행',   color: '#75bf43' },
  siheung_up: { line: '서해선',     label: '소사행',   color: '#75bf43' },
  siheung_dn: { line: '서해선',     label: '원시행',   color: '#75bf43' },
}

// 도보 시간 기준 탑승 상태 판정
function getBoardingStatus(arrivalMin, walkMin) {
  if (arrivalMin == null || walkMin == null) return '여유'
  const diff = arrivalMin - walkMin
  if (diff >= 3) return '여유'
  if (diff >= 0) return '빠듯'
  return '서두르세요'
}

function useFavoriteItems(favorites) {
  // 셔틀 다음 열차 — 방향별
  const { data: shuttleUp }   = useShuttleNext(0) // 등교
  const { data: shuttleDown } = useShuttleNext(1) // 하교
  // 지하철 다음 열차
  const { data: subwayNext } = useSubwayNext()
  // 버스: favKey별 다음 출발까지 남은 분 (실시간 + 시간표)
  const busMinsByRoute = useBusMinutesByFavKey()
  // 3400/6502 그룹별 정류장 id (모달에 정확한 시간표 전달용)
  const { data: stationsData } = useBusStations()
  const stopIdByFavKey = useMemo(() => {
    const byName = (name) => stationsData?.find((s) => s.name === name)?.station_id ?? null
    return {
      '버스 - 서울행:3400': byName('시화'),
      '버스 - 서울행:6502': byName('이마트'),
      '버스 - 학교행:3400': byName('강남역'),
      '버스 - 학교행:6502': byName('사당역'),
    }
  }, [stationsData])

  // 스케줄 페이지가 생성하는 새 형식 favKey("등교:X" / "하교:X" / "기타:X")를
  // 인식하기 위해 백엔드 카테고리별 노선 데이터를 동적으로 읽는다.
  const { data: routesDeung } = useBusRoutesByCategory('등교')
  const { data: routesHa   }  = useBusRoutesByCategory('하교')
  const { data: routesEt   }  = useBusRoutesByCategory('기타')
  const busRouteMeta = useMemo(() => {
    const m = {}
    const add = (cat, list) => {
      for (const r of Array.isArray(list) ? list : []) {
        const stop = r.stops?.[0] ?? null
        m[`${cat}:${r.route_number}`] = { route: r, stop }
      }
    }
    add('등교', routesDeung)
    add('하교', routesHa)
    add('기타', routesEt)
    return m
  }, [routesDeung, routesHa, routesEt])

  const items = useMemo(() => {
    const result = []

    // 즐겨찾기 노선들
    for (const routeCode of favorites.routes ?? []) {
      // 지하철 ("subway:정왕:up" 등) — 방향별 카드
      if (typeof routeCode === 'string' && routeCode.startsWith('subway:')) {
        const parts = routeCode.split(':')
        const station = parts[1] ?? '정왕'
        // 레거시 "subway:정왕" (방향 없음) 은 기본 상행으로 처리
        const legacyDefaultKey = station === '초지' ? 'choji_up' : station === '시흥시청' ? 'siheung_up' : 'up'
        const key = parts[2] ?? legacyDefaultKey
        const info = SUBWAY_KEY_INFO[key] ?? SUBWAY_KEY_INFO.up
        const next = subwayNext?.[key]
        const destLabel = next?.destination ? `${next.destination}행` : info.label
        let min = null
        if (next?.arrive_in_seconds != null) {
          min = Math.max(0, Math.round(next.arrive_in_seconds / 60))
        } else if (next?.depart_at) {
          const [h, mn] = next.depart_at.split(':').map(Number)
          const d = new Date()
          d.setHours(h, mn, 0, 0)
          min = Math.max(0, Math.round((d - new Date()) / 60000))
        }
        result.push({
          id: `route:${routeCode}`,
          type: 'subway',
          routeCode: info.line,
          stationName: station,
          destination: destLabel,
          minutes: min,
          walkMin: 10,
          status: getBoardingStatus(min, 10),
          commute: classifyCommute(routeCode),
          lastTrain: Boolean(next?.last_train),
          detail: {
            type: 'subway',
            routeCode: station,
            subwayKey: key,
            accentColor: info.color,
            title: `${station}역 ${info.line} ${info.label}`,
          },
        })
        continue
      }
      // 셔틀 ("shuttle:등교" / "shuttle:하교")
      if (typeof routeCode === 'string' && routeCode.startsWith('shuttle:')) {
        const label = routeCode.split(':')[1] ?? '등교'
        const direction = label === '하교' ? 1 : 0
        const next = direction === 0 ? shuttleUp : shuttleDown
        const mins = next?.arrive_in_seconds != null
          ? Math.max(0, Math.round(next.arrive_in_seconds / 60))
          : null
        result.push({
          id: `route:${routeCode}`,
          type: 'shuttle',
          routeCode: `${label}셔틀`,
          stationName: '본캠',
          minutes: mins,
          walkMin: 3,
          status: getBoardingStatus(mins, 3),
          commute: classifyCommute(routeCode),
          detail: {
            type: 'shuttle',
            routeCode: `셔틀${label}`,
            direction,
            title: `셔틀버스 ${label}`,
          },
        })
        continue
      }

      // 새 형식 버스 favKey ("등교:X" / "하교:X" / "기타:X") — 스케줄 페이지에서 추가된 항목
      const busParsed = parseBusFavKey(routeCode)
      if (busParsed) {
        const lookup = busRouteMeta?.[routeCode]
        if (!lookup) continue // 아직 카테고리 데이터가 로드되지 않았거나 노선이 존재하지 않음
        const { route, stop } = lookup
        const busNo = route.route_number
        const minKey = NEW_TO_LEGACY_MIN_KEY[routeCode] ?? null
        const mins = minKey ? (busMinsByRoute?.[minKey] ?? null) : null
        const isAccent = busNo === '3400' || busNo === '5200' || busNo === '6502' || busNo === '3401'
        result.push({
          id: `route:${routeCode}`,
          type: 'bus',
          routeCode: busNo,
          stationName: stop?.name ?? null,
          stationId: route.is_realtime && stop?.stop_id != null ? String(stop.stop_id) : null,
          destination: route.direction_name ?? null,
          minutes: mins,
          walkMin: 5,
          status: getBoardingStatus(mins, 5),
          commute: classifyCommute(routeCode),
          detail: {
            type: 'bus',
            routeCode: busNo,
            routeId: route.route_id ?? null,
            stopId: stop?.stop_id ?? null,
            isRealtime: Boolean(route.is_realtime),
            accentColor: isAccent ? '#DC2626' : undefined,
            title: route.direction_name
              ? `${busNo} · ${route.direction_name}`
              : `${busNo}번 버스`,
          },
        })
        continue
      }

      const meta = ROUTE_STATION_MAP[routeCode]
      if (!meta) continue
      const mins = busMinsByRoute?.[routeCode] ?? null
      const isSeoulBus = routeCode.startsWith('버스 - ')
      const busNo = isSeoulBus ? routeCode.split(':')[1] : meta.routeCode
      result.push({
        id: `route:${routeCode}`,
        type: 'bus',
        routeCode: meta.routeCode,
        stationName: meta.stationName,
        stationId: meta.stationId,
        destination: meta.endpoints ?? null,
        minutes: mins,
        walkMin: 5,
        status: getBoardingStatus(mins, 5),
        commute: classifyCommute(routeCode),
        detail: {
          type: 'bus',
          routeCode: busNo,
          stopId: stopIdByFavKey?.[routeCode] ?? null,
          accentColor: (busNo === '3400' || busNo === '5200' || busNo === '6502') ? '#DC2626' : undefined,
          title: isSeoulBus ? `${busNo} · ${meta.endpoints}` : `${busNo}번 버스`,
        },
      })
    }

    return result
  }, [favorites.routes, shuttleUp, shuttleDown, subwayNext, busMinsByRoute, stopIdByFavKey, busRouteMeta])

  return items
}

export default function FavoritesPage({ onGoSchedule }) {
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)

  const items = useFavoriteItems(favorites)
  const allEmpty = items.length === 0

  const [commute, setCommute] = useState('등교')
  const [view, setView] = useState('list')
  const [selectedDetail, setSelectedDetail] = useState(null)

  const filtered = useMemo(
    () => items.filter((it) => (it.commute ?? '하교') === commute),
    [items, commute],
  )

  // 15초마다 타임라인 리렌더 (minutes 재계산용) — 실제 fetch는 내부 훅의 interval이 담당
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  function handleRemove(id) {
    // id: "route:<favCode>" | "station:<code>" — favCode는 "하교:20-1"처럼 콜론 포함 가능
    const idx = id.indexOf(':')
    if (idx === -1) return
    const type = id.slice(0, idx)
    const code = id.slice(idx + 1)
    if (type === 'route') toggleFavoriteRoute(code)
    else toggleFavoriteStation(code)
  }

  function handleOpenDetail(detail) {
    if (detail) setSelectedDetail(detail)
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-bg-dark animate-fade-in-up">
      <PageHeader title="즐겨찾기" subtitle="등교 / 하교 · 15초마다 갱신" />

      <div className="flex items-center justify-between gap-2 px-4 pb-2">
        <SegmentTabs
          tabs={[{ id: '등교', label: '등교' }, { id: '하교', label: '하교' }]}
          active={commute}
          onChange={setCommute}
        />
        <SegmentTabs
          tabs={[{ id: 'list', label: '리스트' }, { id: 'timeline', label: '타임라인' }]}
          active={view}
          onChange={setView}
          size="sm"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28 md:pb-6 flex flex-col gap-3">
        {allEmpty ? (
          <div className="rounded-[18px] overflow-hidden shadow-card bg-white dark:bg-surface-dark border border-slate-100 dark:border-border-dark">
            <EmptyState
              icon={<Star size={28} strokeWidth={1.6} />}
              title="즐겨찾는 노선이 없어요"
              desc="노선 목록에서 별 아이콘을 탭해 추가"
              ctaLabel="시간표에서 추가"
              onCta={onGoSchedule}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[18px] overflow-hidden shadow-card bg-white dark:bg-surface-dark border border-slate-100 dark:border-border-dark">
            <EmptyState
              icon={<Star size={28} strokeWidth={1.6} />}
              title={`${commute}용 즐겨찾기가 없어요`}
              desc="다른 탭을 확인해 보세요"
            />
          </div>
        ) : view === 'timeline' ? (
          <FavoritesTimeline items={filtered} onOpenDetail={handleOpenDetail} />
        ) : (
          <FavoritesList
            items={filtered}
            onRemove={handleRemove}
            onOpenDetail={handleOpenDetail}
          />
        )}
      </div>

      <ScheduleDetailModal
        open={selectedDetail != null}
        onClose={() => setSelectedDetail(null)}
        type={selectedDetail?.type}
        routeCode={selectedDetail?.routeCode}
        stopId={selectedDetail?.stopId ?? null}
        direction={selectedDetail?.direction}
        subwayKey={selectedDetail?.subwayKey}
        accentColor={selectedDetail?.accentColor}
        isRealtime={selectedDetail?.isRealtime ?? false}
        title={selectedDetail?.title ?? ''}
      />
    </div>
  )
}
