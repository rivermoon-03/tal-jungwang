import { useState, useEffect } from 'react'
import { useSubwayTimetable } from '../../hooks/useSubway'
import { useBusArrivals } from '../../hooks/useBus'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import InfoPanelMobile from './InfoPanelMobile'
import InfoPanelPC from './InfoPanelPC'
import { SEOUL_STATION_ID } from './InfoPanelTabs'

const JEONGWANG_STATION_ID = '224000639'
const DEFAULT_WALK_SEC = 720

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

export default function InfoPanel() {
  const [tab, setTab] = useState('jeongwang')
  const isMobile = useIsMobile()

  const { data: timetableData }    = useSubwayTimetable()
  const subwayData = timetableData ? {
    up:        getNextTrain(timetableData.up),
    down:      getNextTrain(timetableData.down),
    line4_up:  getNextTrain(timetableData.line4_up),
    line4_down: getNextTrain(timetableData.line4_down),
  } : null
  const { data: busJeongwangData } = useBusArrivals(JEONGWANG_STATION_ID)
  const { data: busSeoulData }     = useBusArrivals(SEOUL_STATION_ID)
  const { data: shuttleSchedule }  = useShuttleSchedule()
  const { data: timetable3400 }    = useBusTimetableByRoute('3400')
  const { data: timetable6502 }    = useBusTimetableByRoute('6502')

  const walkSec = DEFAULT_WALK_SEC
  const shuttleDirections = computeShuttleDirections(shuttleSchedule)
  const seoulNextDepartures = [
    { route: '3400', time: getNextFromTimetable(timetable3400) },
    { route: '6502', time: getNextFromTimetable(timetable6502) },
  ]

  const props = {
    tab, setTab,
    subwayData, busJeongwangData, busSeoulData,
    shuttleDirections,
    seoulNextDepartures,
    walkSec,
  }

  return isMobile ? <InfoPanelMobile {...props} /> : <InfoPanelPC {...props} />
}
