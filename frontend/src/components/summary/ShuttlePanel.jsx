import { useMemo } from 'react'
import { CalendarOff } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import { SkeletonPanelRow } from '../common/Skeleton'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import MascotDot from '../ui/MascotDot'
import DualDirectionCard from '../common/DualDirectionCard'
import { getNextShuttleBusInfo } from '../../utils/nextShuttleBus.js'

/**
 * ShuttlePanel — 셔틀 모드 패널.
 *
 * 한 카드 안에 등교 / 하교를 듀얼 컬럼으로. 캠퍼스(본캠/2캠) 선택에 따라
 *   본캠: direction 0(등교) + 1(하교)
 *   2캠 : direction 2(등교) + 3(하교)
 *
 * 주말·방학 처리:
 *   - 본캠: 주말·방학 모두 미운영 안내
 *   - 2캠: 일요일·방학은 미운영, 토요일은 정상 운행 흐름
 */

// direction: 0=본캠 등교, 1=본캠 하교, 2=2캠 등교, 3=2캠 하교
const DIR_META = {
  0: { arrow: '↑', label: '등교', origin: '정왕역', dest: '본캠' },
  1: { arrow: '↓', label: '하교', origin: '본캠',   dest: '정왕역' },
  2: { arrow: '↑', label: '등교', origin: '본캠',   dest: '2캠' },
  3: { arrow: '↓', label: '하교', origin: '2캠',    dest: '본캠' },
}

const RETURN_ORIGIN = { 0: '본캠', 2: '2캠' }

const NO_RUN_CODES = new Set(['NO_SHUTTLE', 'NO_SCHEDULE'])

function offsetDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function toMin(t) {
  const [h, m] = (t ?? '00:00').split(':').map(Number)
  return h * 60 + m
}

// KST 기준 요일 (0=일, 1=월, ..., 6=토)
function getKstDayOfWeek() {
  const now = new Date()
  // KST = UTC+9
  const kstOffset = 9 * 60
  const utcMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const kstMin = utcMin + kstOffset
  const kstDayExtra = Math.floor(kstMin / (24 * 60))
  const utcDay = now.getUTCDay()
  return (utcDay + kstDayExtra) % 7
}

// 2캠 + 토요일 예외: 토요일에도 정상 운행하므로 미운영 처리하지 않음
function isSecondCampusSaturday(campus) {
  return campus === 'second' && getKstDayOfWeek() === 6
}

// ShuttleCard.isInsideFrequentWindow 와 동일한 로직 — 스케줄 전체 데이터 기반
function checkInsideFrequentWindow(scheduleData, direction) {
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const times = scheduleData?.directions?.find((d) => d.direction === direction)?.times ?? []
  const hasPastFrequent = times.some((t) => t.note === '수시운행' && toMin(t.depart_at) <= nowMin)
  const next = times.find((t) => toMin(t.depart_at) > nowMin)
  return hasPastFrequent && next?.note === '수시운행'
}

export default function ShuttlePanel() {
  const campus = useAppStore((s) => s.selectedShuttleCampus)
  const setDetailModal = useAppStore((s) => s.setDetailModal)

  const [goDir, backDir] = campus === 'second' ? [2, 3] : [0, 1]
  const goQuery = useShuttleNext(goDir)
  const backQuery = useShuttleNext(backDir)
  // 오늘 전체 시간표 — 수시운행 창 진입 여부 판별용 (5분 TTL 캐시, 추가 네트워크 없음)
  // error도 받음: NO_SCHEDULE(방학/휴일)는 schedule 쪽에만 오고, next는 NO_SHUTTLE을 주므로
  const { data: schedule, error: scheduleError } = useShuttleSchedule()

  const anyLoading = goQuery.loading || backQuery.loading

  // 내일/모레 날짜 문자열 (마운트 시 한 번 계산)
  const tom1 = useMemo(() => offsetDate(1), [])
  const tom2 = useMemo(() => offsetDate(2), [])

  const goData = normalizeData(goQuery)
  const backData = normalizeData(backQuery)

  // 운행 종료 여부 (데이터도 에러도 확정된 상태)
  const goRunsOut = !goData && !goQuery.loading
  const backRunsOut = !backData && !backQuery.loading

  // 내일/모레 시간표 — 주말 시간표가 없는 캠퍼스는 모레까지 탐색
  const goTom1 = useShuttleSchedule(goDir, tom1, { enabled: goRunsOut })
  const goTom2 = useShuttleSchedule(goDir, tom2, { enabled: goRunsOut })
  const backTom1 = useShuttleSchedule(backDir, tom1, { enabled: backRunsOut })
  const backTom2 = useShuttleSchedule(backDir, tom2, { enabled: backRunsOut })

  const goFirstTomorrow =
    goTom1.data?.directions?.[0]?.times?.[0]?.depart_at ??
    goTom2.data?.directions?.[0]?.times?.[0]?.depart_at ?? null
  const backFirstTomorrow =
    backTom1.data?.directions?.[0]?.times?.[0]?.depart_at ??
    backTom2.data?.directions?.[0]?.times?.[0]?.depart_at ?? null

  if (anyLoading && !goQuery.data && !backQuery.data) {
    return (
      <div className="space-y-2">
        <SkeletonPanelRow />
      </div>
    )
  }

  const goHardError = goQuery.error && !NO_RUN_CODES.has(goQuery.error.code)
  const backHardError = backQuery.error && !NO_RUN_CODES.has(backQuery.error.code)
  if (goHardError && backHardError) {
    return (
      <ErrorState
        message="셔틀 정보 오류"
        onRetry={() => { goQuery.refetch?.(); backQuery.refetch?.() }}
        className="py-4"
      />
    )
  }

  // 2캠 + 토요일 예외: NO_SCHEDULE이어도 정상 흐름으로 진행
  // (서버에서 2캠 토요일 스케줄을 제공하므로, scheduleError를 미운영 판정에서 제외)
  const skipNoSchedule = isSecondCampusSaturday(campus)

  // NO_SCHEDULE: 방학/휴일 — 스케줄 자체 없음.
  // schedule 응답이 NO_SCHEDULE면 next가 NO_SHUTTLE을 주더라도 방학 안내를 우선한다.
  // 단, 2캠+토요일이면 미운영 판정 건너뜀.
  const goNoSchedule = goQuery.error?.code === 'NO_SCHEDULE'
  const backNoSchedule = backQuery.error?.code === 'NO_SCHEDULE'
  const isVacation =
    !skipNoSchedule &&
    (scheduleError?.code === 'NO_SCHEDULE' || (goNoSchedule && backNoSchedule))
  if (isVacation) {
    return (
      <EmptyState
        icon={<CalendarOff size={28} strokeWidth={1.5} />}
        title="주말·방학에는 셔틀을 운행하지 않아요"
        desc="학기 중 평일에 다시 확인해 주세요"
      />
    )
  }

  // NO_SHUTTLE: 운행일이지만 오늘 운행 종료 — "답이 있는 빈 상태": 그냥 끝났다고
  // 알리지 않고, 이미 갖고 있는 내일 시간표(goTom/backTom)에서 다음 첫차를 계산해 보여준다.
  const goNoShuttle = goQuery.error?.code === 'NO_SHUTTLE'
  const backNoShuttle = backQuery.error?.code === 'NO_SHUTTLE'
  if (goNoShuttle && backNoShuttle) {
    const nextBus = getNextShuttleBusInfo(goFirstTomorrow, backFirstTomorrow)
    return (
      <EmptyState
        icon={<MascotDot />}
        altText="운행을 마치고 잠든 셔틀버스"
        title="오늘 셔틀 운행이 끝났어요"
        nextInfo={nextBus ? { label: '내일 첫차', time: nextBus.time, sub: nextBus.sub } : null}
        desc={nextBus ? null : '내일 첫차 시간을 확인해 주세요'}
      />
    )
  }

  const goInsideWindow = checkInsideFrequentWindow(schedule, goDir)
  const backInsideWindow = checkInsideFrequentWindow(schedule, backDir)

  const left = toSlot(goData, goDir, goFirstTomorrow, goInsideWindow)
  const right = toSlot(backData, backDir, backFirstTomorrow, backInsideWindow)

  function openModal(dir) {
    const meta = DIR_META[dir]
    const campusTag = dir >= 2 ? '2캠 ' : ''
    setDetailModal({
      type: 'shuttle',
      routeCode: `${campusTag}셔틀${meta.label}`,
      direction: dir,
      favCode: `shuttle:${campusTag}${meta.label}`.trim(),
      title: `${campusTag}셔틀버스 ${meta.label}`,
    })
  }

  const isSeasonal = schedule?.schedule_type === 'SEASONAL'

  return (
    <div className="space-y-2">
      {isSeasonal && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-micro font-semibold px-2 py-0.5 rounded-full bg-accent/12 text-accent dark:text-accent tracking-wide">
            계절학기
          </span>
          <span className="text-caption text-mute dark:text-mute truncate">
            방학 축소 운행 시간표예요
          </span>
        </div>
      )}
      <DualDirectionCard
        symbol="셔"
        symbolColor="var(--tj-accent)"
        lineName={campus === 'second' ? '2캠 셔틀버스' : '셔틀버스'}
        sub="다음 출발"
        left={left}
        right={right}
        onLeftClick={() => openModal(goDir)}
        onRightClick={() => openModal(backDir)}
      />
    </div>
  )
}

function normalizeData(query) {
  if (query.data) return query.data
  if (query.error && NO_RUN_CODES.has(query.error.code)) return null
  return null
}

function toSlot(data, direction, firstTomorrow = null, isInsideFreqWindow = false) {
  const meta = DIR_META[direction]
  if (!meta) return { variant: 'empty' }
  const dirText = `${meta.arrow} ${meta.label}`
  if (!data?.depart_at) return { variant: 'empty', dir: dirText, firstTomorrow }

  const isReturn = !!data.note?.includes('회차편')
  const isFrequent = data.note === '수시운행'

  if (isReturn) {
    const time = data.note.match(/(\d{2}:\d{2})/)?.[1] ?? data.depart_at.slice(0, 5)
    const origin = RETURN_ORIGIN[direction] ?? '학교'
    return {
      variant: 'return',
      dir: dirText,
      returnChipLabel: '회차편',
      time,
      descLine1: `에 ${origin}에서 출발한 버스`,
      descLine2: '회차탑승',
    }
  }

  // 수시운행 창 밖(아직 시작 전)이면 일반 슬롯으로 표시 — "수시운행 중"으로 오해하지 않도록
  if (isFrequent && !isInsideFreqWindow) {
    const sec = data.arrive_in_seconds
    const minutes = sec != null ? Math.max(0, Math.ceil(sec / 60)) : null
    const nextMinutes = data.next_arrive_in_seconds != null
      ? Math.max(0, Math.ceil(data.next_arrive_in_seconds / 60))
      : null
    const imminent = sec != null && sec >= 0 && sec < 60
    return {
      variant: 'normal',
      dir: dirText,
      route: `${meta.origin} → ${meta.dest}`,
      minutes,
      nextMinutes,
      imminentLabel: imminent ? '곧 출발' : null,
      isUrgent: imminent || (minutes != null && minutes <= 3),
    }
  }

  if (isFrequent) {
    return {
      variant: 'frequent',
      dir: dirText,
      route: `${meta.origin} → ${meta.dest}`,
      freqLabel: '수시운행',
      freqSub: '약 10분 간격',
    }
  }

  const sec = data.arrive_in_seconds
  const minutes = sec != null ? Math.max(0, Math.ceil(sec / 60)) : null
  const nextMinutes = data.next_arrive_in_seconds != null
    ? Math.max(0, Math.ceil(data.next_arrive_in_seconds / 60))
    : null
  const imminent = sec != null && sec >= 0 && sec < 60

  return {
    variant: 'normal',
    dir: dirText,
    route: `${meta.origin} → ${meta.dest}`,
    minutes,
    nextMinutes,
    imminentLabel: imminent ? '곧 출발' : null,
    isUrgent: imminent || (minutes != null && minutes <= 3),
  }
}
