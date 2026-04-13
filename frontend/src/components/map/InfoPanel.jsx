import { useState, useEffect, useMemo, useRef } from 'react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import { useBusArrivals } from '../../hooks/useBus'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import InfoPanelMobile from './InfoPanelMobile'
import InfoPanelPC from './InfoPanelPC'
import { SEOUL_STATION_ID } from './InfoPanelTabs'
import useAppStore from '../../stores/useAppStore'
import { apiFetch } from '../../hooks/useApi'

const JEONGWANG_STATION_ID = '224000639'
const DEFAULT_WALK_SEC = 720

const WALK_DESTINATIONS = {
  shuttle: { lat: 37.339343, lng: 126.73279 },
  bus:     { lat: 37.3400,   lng: 126.7335  },
  station: { lat: 37.351618, lng: 126.742747 },
}

// ShuttleTab과 동일한 매핑 — DB의 원본 route_name을 표시용 이름으로 변환
const DIRECTION_LABEL = {
  '정왕역행 (하교)':  '정왕역행 (하교)',
  '학교행 (등교)':    '학교행 (등교)',
  '정왕역방면':       '정왕역행 (하교)',
  '정왕역→학교':     '학교행 (등교)',
  '하교 (정왕역행)':  '정왕역행 (하교)',
  '등교 (학교행)':    '학교행 (등교)',
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

function computeShuttleDirections(schedule) {
  if (!schedule?.directions?.length) return []
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()

  return schedule.directions.map(({ direction, times }) => {
    const mappedDirection = DIRECTION_LABEL[direction] ?? direction
    const next = times.find((t) => {
      const [hh, mm] = t.depart_at.split(':').map(Number)
      return hh * 60 + mm > nowMin
    })
    if (!next) return { direction: mappedDirection, diffSec: null, nextTime: null }
    const [hh, mm] = next.depart_at.split(':').map(Number)
    const diffSec = hh * 3600 + mm * 60 - nowSec
    return { direction: mappedDirection, diffSec: diffSec > 0 ? diffSec : null, nextTime: next.depart_at }
  })
}

function getNextFromTimetable(timetable) {
  if (!timetable?.times?.length) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return (
    timetable.times.find((t) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm > nowMin
    }) ?? null
  )
}

/** 시간표 배열에서 클라이언트 시각 기준 다음 열차 반환 */
function getNextTrain(trains) {
  if (!trains?.length) return null
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return (
    trains.find((t) => {
      const [hh, mm] = t.depart_at.split(':').map(Number)
      return hh * 60 + mm > nowMin
    }) ?? null
  )
}

function AboutModal({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm px-5"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl px-7 py-6 flex flex-col gap-4 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide text-center">
            Made with ❤️ by 소공
          </p>
          <p className="text-[11px] text-slate-400">한국공대 ㅎㅇㅌ</p>
        </div>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
          지하철, 3400/6502, 셔틀버스 정보는 각각의 공식 시간표에서 가져왔습니다.
          예상치 못한 일이 생기면 달라질 수 있습니다.
          <br />
          <span className="text-slate-400">(수인분당 제대로 오는 꼬라지를 본 적이 없어요.)</span>
        </p>
        <p className="text-[12px] text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-3">
          아직 테스트 버전입니다. 실시간 버스 기능은 믿지 말아주세요.
        </p>
        <button
          onClick={onClose}
          className="self-center px-5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function hasVisitedCookie() {
  return document.cookie.split(';').some((c) => c.trim().startsWith('tal_visited='))
}

function setVisitedCookie() {
  const expires = new Date()
  expires.setFullYear(expires.getFullYear() + 1)
  document.cookie = `tal_visited=1; expires=${expires.toUTCString()}; path=/`
}

export default function InfoPanel() {
  const [tab, setTab] = useState('jeongwang')
  const [infoOpen, setInfoOpen] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(() => !hasVisitedCookie())
  const isMobile = useIsMobile()
  const setTabBadges = useAppStore((s) => s.setTabBadges)
  const userLocation = useAppStore((s) => s.userLocation)

  const [walkTimes, setWalkTimes] = useState({
    shuttle: DEFAULT_WALK_SEC,
    bus:     DEFAULT_WALK_SEC,
    station: DEFAULT_WALK_SEC,
  })
  const walkFetchedRef = useRef(false)

  useEffect(() => {
    if (!userLocation || walkFetchedRef.current) return
    walkFetchedRef.current = true

    const origin = { lat: userLocation.lat, lng: userLocation.lng }
    const fetchWalk = (destination) =>
      apiFetch('/route/walking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination }),
      }).catch(() => null)

    Promise.all([
      fetchWalk(WALK_DESTINATIONS.shuttle),
      fetchWalk(WALK_DESTINATIONS.bus),
      fetchWalk(WALK_DESTINATIONS.station),
    ]).then(([shuttleRes, busRes, stationRes]) => {
      setWalkTimes({
        shuttle: shuttleRes?.duration_seconds ?? DEFAULT_WALK_SEC,
        bus:     busRes?.duration_seconds     ?? DEFAULT_WALK_SEC,
        station: stationRes?.duration_seconds ?? DEFAULT_WALK_SEC,
      })
    })
  }, [userLocation])

  const { data: timetableData }    = useSubwayTimetable()
  const subwayData = timetableData ? {
    up:        getNextTrain(timetableData.up),
    down:      getNextTrain(timetableData.down),
    line4_up:  getNextTrain(timetableData.line4_up),
    line4_down: getNextTrain(timetableData.line4_down),
  } : null
  const { data: busJeongwangData, fetchedAt: busJeongwangFetchedAt } = useBusArrivals(JEONGWANG_STATION_ID)
  const { data: busSeoulData }     = useBusArrivals(SEOUL_STATION_ID)

  const adjustedBusJeongwangData = useMemo(() => {
    if (!busJeongwangData?.arrivals || !busJeongwangFetchedAt) return busJeongwangData
    const elapsedSec = (Date.now() - busJeongwangFetchedAt) / 1000
    return {
      ...busJeongwangData,
      arrivals: busJeongwangData.arrivals.map((a) =>
        a.arrival_type === 'realtime'
          ? { ...a, arrive_in_seconds: Math.max(0, a.arrive_in_seconds - elapsedSec) }
          : a
      ),
    }
  }, [busJeongwangData, busJeongwangFetchedAt])
  const { data: shuttleSchedule }  = useShuttleSchedule()
  const { data: timetable3400 }    = useBusTimetableByRoute('3400')
  const { data: timetable6502 }    = useBusTimetableByRoute('6502')

  const shuttleDirections = computeShuttleDirections(shuttleSchedule)

  // ── 탭 배지 계산 ──────────────────────────────────────────
  useEffect(() => {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

    const shuttleBadge = shuttleDirections.some(
      (d) => d.diffSec != null && d.diffSec <= 300
    )

    const busBadge = (adjustedBusJeongwangData?.arrivals ?? []).some(
      (a) => a.arrival_type === 'realtime' && a.arrive_in_seconds <= 180
    )

    setTabBadges({ shuttle: shuttleBadge, bus: busBadge, subway: false })
  }, [shuttleDirections, adjustedBusJeongwangData, timetableData, setTabBadges])
  const seoulNextDepartures = [
    { route: '3400', time: getNextFromTimetable(timetable3400) },
    { route: '6502', time: getNextFromTimetable(timetable6502) },
  ]

  const props = {
    tab, setTab,
    subwayData, busJeongwangData: adjustedBusJeongwangData, busSeoulData,
    shuttleDirections,
    seoulNextDepartures,
    walkTimes,
    timetableData,
    onInfoClick: () => {
      if (isFirstVisit) {
        setVisitedCookie()
        setIsFirstVisit(false)
      }
      setInfoOpen(true)
    },
    isFirstVisit,
  }

  return (
    <>
      {isMobile ? <InfoPanelMobile {...props} /> : <InfoPanelPC {...props} />}
      {infoOpen && <AboutModal onClose={() => setInfoOpen(false)} />}
    </>
  )
}
