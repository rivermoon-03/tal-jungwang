/**
 * FavoritesPage — 즐겨찾기 탭 (라이브 타일)
 *
 * 즐겨찾기 대상: routes + stations (Zustand persist)
 * 라이브 데이터: useBusArrivals로 정류장 도착 정보 가져옴 (shuttle/subway 다음 열차도)
 * TODO: 즐겨찾기 항목마다 개별 API 호출 대신 batch 엔드포인트 추가 시 교체
 */
import { useMemo, useState } from 'react'
import { Bus } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import FavoritesList from './FavoritesList'
import EmptyState from '../common/EmptyState'
import PageHeader from '../layout/PageHeader'
import ScheduleDetailModal from '../schedule/ScheduleDetailModal'
import { useShuttleNext } from '../../hooks/useShuttle'
import { useSubwayNext } from '../../hooks/useSubway'
import { useBusTimetableByRoute, useBusArrivals, useBusStations } from '../../hooks/useBus'

// 버스 노선별 다음 출발까지 남은 분 (favKey → minutes)
function useBusMinutesByFavKey() {
  // 실시간 (GBIS) — 20-1, 시흥33 (한국공대), 시흥1 (이마트)
  const realtimeHanguk = useBusArrivals('224000639')
  const realtimeEmart  = useBusArrivals('224000513')

  // 3400/6502 정류장별 시간표
  const { data: stationsData } = useBusStations()
  const byName = (name) => stationsData?.find((s) => s.name === name)?.station_id ?? null
  const sihwa   = byName('시화 (3400 시종착)')
  const emart   = byName('이마트 (6502·시흥1번 정류장)')
  const gangnam = byName('강남역 3400 정류장')
  const sadang  = byName('사당역 14번 출구')

  const r3400Seoul  = useBusTimetableByRoute('3400', { stopId: sihwa   ?? undefined })
  const r3400School = useBusTimetableByRoute('3400', { stopId: gangnam ?? undefined })
  const r6502Seoul  = useBusTimetableByRoute('6502', { stopId: emart   ?? undefined })
  const r6502School = useBusTimetableByRoute('6502', { stopId: sadang  ?? undefined })

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
  '20-1':   { stationId: '224000639', stationName: '한국공학대학교', type: 'bus', routeCode: '20-1' },
  '시흥33': { stationId: '224000639', stationName: '한국공학대학교', type: 'bus', routeCode: '시흥33' },
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
          routeCode: `셔틀 ${label}`,
          stationName: '한국공학대학교',
          minutes: mins,
          walkMin: 3,
          status: getBoardingStatus(mins, 3),
          detail: {
            type: 'shuttle',
            routeCode: `셔틀${label}`,
            direction,
            title: `셔틀버스 ${label}`,
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
        detail: {
          type: 'bus',
          routeCode: busNo,
          accentColor: (busNo === '3400' || busNo === '6502') ? '#DC2626' : undefined,
          title: isSeoulBus ? `${busNo} · ${meta.endpoints}` : `${busNo}번 버스`,
        },
      })
    }

    return result
  }, [favorites.routes, shuttleUp, shuttleDown, subwayNext, busMinsByRoute])

  return items
}

export default function FavoritesPage({ onGoSchedule }) {
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteRoute = useAppStore((s) => s.toggleFavoriteRoute)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)

  const items = useFavoriteItems(favorites)
  const isEmpty = items.length === 0

  const [selectedDetail, setSelectedDetail] = useState(null)

  function handleRemove(id) {
    const [type, code] = id.split(':')
    if (type === 'route') toggleFavoriteRoute(code)
    else toggleFavoriteStation(code)
  }

  function handleOpenDetail(detail) {
    if (detail) setSelectedDetail(detail)
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 animate-fade-in-up">
      <PageHeader title="즐겨찾기" subtitle="자주 타는 노선을 한눈에" />

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28 md:pb-6 flex flex-col gap-3">
        {isEmpty ? (
          <div className="rounded-[18px] overflow-hidden shadow-card bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <EmptyState
              icon={<Bus size={36} />}
              title="아직 비어있어요"
              desc="자주 타는 노선이나 정류장을 즐겨찾기 해보세요"
              ctaLabel="시간표에서 추가"
              onCta={onGoSchedule}
            />
          </div>
        ) : (
          <FavoritesList
            items={items}
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
        direction={selectedDetail?.direction}
        subwayKey={selectedDetail?.subwayKey}
        accentColor={selectedDetail?.accentColor}
        title={selectedDetail?.title ?? ''}
      />
    </div>
  )
}
