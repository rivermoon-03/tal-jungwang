import { useMemo } from 'react'
import { CalendarOff } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import { SkeletonPanelRow } from '../common/Skeleton'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import MascotDot from '../ui/MascotDot'
import TransitCard from '../ui/TransitCard.jsx'
import { getNextShuttleBusInfo } from '../../utils/nextShuttleBus.js'
import { PERIOD_VARIANTS, periodVariantKey } from '../shuttle/shuttlePeriods'

// 결함 #4 — 버스/지하철 패널과 동일 규칙: ETA 5분 이하만 임박(색만) 처리.
// (예전엔 3분 기준이었다 — toSlot()의 isUrgent 판정을 아래에서 5분 기준으로 맞춘다.)
const SOON_THRESHOLD_MIN = 5

/**
 * ShuttlePanel — 셔틀 모드 패널.
 *
 * 한 카드 안에 등교 / 하교를 듀얼 컬럼으로. 캠퍼스(본캠/2캠) 선택에 따라
 *   본캠: direction 0(등교) + 1(하교)
 *   2캠 : direction 2(등교) + 3(하교)
 *
 * 미운행 처리(D1 이후):
 *   - 방학에도 방학 기간 시간표(schedule_periods)가 있으면 정상 흐름이다.
 *   - NO_SCHEDULE = 등록된 운행 기간 자체가 없음 → "시간표가 없는 기간" + 시내버스 안내
 *   - 기간은 있지만 오늘 요일 편성이 0건(주말) → "오늘은 운행하지 않아요" + 다음 첫차
 *   - 2캠: 토요일 편성이 있는 기간(일학습 등)은 토요일도 정상 운행 흐름
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
    // D1: 방학에도 셔틀은 운행한다(방학 기간 시간표가 DB에 시드됨). 여기 도달하는
    // 것은 '등록된 운행 기간 자체가 없는' 데이터 공백 — 사실대로 안내하고
    // 같은 구간 시내버스라는 다음 행동을 제시한다(막다른 화면 금지).
    return (
      <EmptyState
        icon={<CalendarOff size={28} strokeWidth={1.5} />}
        title="지금은 셔틀 시간표가 없는 기간이에요"
        desc="시간표가 반영되면 다시 보여드릴게요 · 정왕역은 20-1 · 시흥33 버스로 갈 수 있어요"
      />
    )
  }

  // 운행 기간은 있지만 오늘 요일 편성이 0건(주말 등) — '운행 종료'와 구분한다.
  const dirTimes = (dir) => schedule?.directions?.find((d) => d.direction === dir)?.times ?? []
  const todayNoService = !!schedule && dirTimes(goDir).length === 0 && dirTimes(backDir).length === 0

  // NO_SHUTTLE: 운행일이지만 오늘 운행 종료 — "답이 있는 빈 상태": 그냥 끝났다고
  // 알리지 않고, 이미 갖고 있는 내일 시간표(goTom/backTom)에서 다음 첫차를 계산해 보여준다.
  // 상세 시트 열기 — 빈 상태(운행 종료/미운행일)의 "시간표 보기" 버튼도 이걸 쓴다.
  // 상세 시트는 미운행일이면 다음 평일 시간표로 자동 폴백한다(ShuttleContent).
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

  const goNoShuttle = goQuery.error?.code === 'NO_SHUTTLE'
  const backNoShuttle = backQuery.error?.code === 'NO_SHUTTLE'
  if (goNoShuttle && backNoShuttle) {
    const nextBus = getNextShuttleBusInfo(goFirstTomorrow, backFirstTomorrow)
    // 오늘 편성이 아예 없는 날(주말)은 "끝났어요"가 아니라 "운행하지 않아요"가 사실.
    if (todayNoService) {
      return (
        <EmptyState
          icon={<CalendarOff size={28} strokeWidth={1.5} />}
          title="오늘은 셔틀이 운행하지 않아요"
          nextInfo={nextBus ? { label: '다음 첫차', time: nextBus.time, sub: nextBus.sub } : null}
          desc={nextBus ? null : '다음 운행일 첫차 시간을 확인해 주세요'}
          action={{ label: '시간표 보기', onClick: () => openModal(goDir) }}
        />
      )
    }
    return (
      <EmptyState
        icon={<MascotDot />}
        altText="운행을 마치고 잠든 셔틀버스"
        title="오늘 셔틀 운행이 끝났어요"
        nextInfo={nextBus ? { label: '내일 첫차', time: nextBus.time, sub: nextBus.sub } : null}
        desc={nextBus ? null : '내일 첫차 시간을 확인해 주세요'}
        action={{ label: '시간표 보기', onClick: () => openModal(goDir) }}
      />
    )
  }

  const goInsideWindow = checkInsideFrequentWindow(schedule, goDir)
  const backInsideWindow = checkInsideFrequentWindow(schedule, backDir)

  const left = toSlot(goData, goDir, goFirstTomorrow, goInsideWindow)
  const right = toSlot(backData, backDir, backFirstTomorrow, backInsideWindow)
  // size='lg' "다음 차 카드" 승격을 걷어냈다. BusPanel은 여러 노선이 서로 경쟁하는
  // 대안이라 그중 더 빠른 하나를 크게 짚는 게 의미 있지만, 여기 등교/하교는 대안
  // 관계가 아니다 — 사용자는 그날 필요한 방향 하나만 본다("어느 쪽이 더 빠른가"를
  // 비교할 이유가 없다). 그런데도 한쪽만 커지면 나란히 놓인 동일 규격 카드 둘의
  // 크기가 달라져 위계가 아니라 오류로 읽힌다. 두 카드 모두 기본 크기(md)로 통일.

  // 방학·계절학기 등 비학기 기간이면 기간 배지(계절학기=빨강 · 단축근무=초록 ·
  // 정상근무=파랑 칩 팔레트, 학교 PDF 색 구분과 동일)를 노출한다.
  const isOffSemester = schedule?.schedule_type && schedule.schedule_type !== 'SEMESTER'
  const periodTagKey = isOffSemester ? periodVariantKey({ name: schedule?.schedule_name ?? '' }) : null
  const periodTagMeta = periodTagKey ? PERIOD_VARIANTS[periodTagKey] : null

  return (
    <div className="space-y-2">
      {isOffSemester && (
        <div className="flex items-center gap-2 px-1">
          <span
            className={`text-meta font-semibold px-2 py-0.5 rounded-full tracking-wide ${
              periodTagMeta ? periodTagMeta.chipClass : 'bg-accent/12 text-accent dark:text-accent'
            }`}
          >
            {periodTagMeta ? periodTagMeta.label : '방학'}
          </span>
          <span className="text-caption text-mute dark:text-mute truncate">
            {schedule?.schedule_name ? `${schedule.schedule_name} 시간표예요` : '방학 시간표예요'}
          </span>
        </div>
      )}
      {/* 결함 #4 — DualDirectionCard(좌우 듀얼 컬럼) 대신 방향별 TransitCard 두 장으로 통일. */}
      <div className="flex items-center justify-between px-0.5">
        <h3 className="text-mini-ttl font-bold text-ink dark:text-ink">
          {campus === 'second' ? '2캠 셔틀버스' : '셔틀버스'}
        </h3>
        <span className="text-meta font-semibold text-mute dark:text-mute">다음 출발</span>
      </div>
      <div className="space-y-2">
        <TransitCard
          badge={{ label: '셔틀', bgVar: 'var(--tj-accent)', mode: 'shuttle' }}
          onClick={() => openModal(goDir)}
          {...slotToCardProps(left)}
        />
        <TransitCard
          badge={{ label: '셔틀', bgVar: 'var(--tj-accent)', mode: 'shuttle' }}
          onClick={() => openModal(backDir)}
          {...slotToCardProps(right)}
        />
      </div>
    </div>
  )
}

/**
 * toSlot()의 variant별 결과를 TransitCard props로 변환한다. title은 방향 라벨만
 * (dir 문자열 "↑ 등교"에서 화살표를 떼고 "등교"만) — 화살표는 시각적 군더더기라
 * TransitCard의 15px 굵은 제목엔 텍스트만 남긴다.
 */
function slotToCardProps(slot) {
  const title = slot?.dir ? slot.dir.split(' ').pop() : '셔틀버스'

  if (!slot || slot.variant === 'empty') {
    return {
      title,
      muted: true,
      chips: [],
      eta: {
        primary: { text: '운행 없음', tone: 'muted' },
        secondary: slot?.firstTomorrow ? { text: `내일 첫차 ${slot.firstTomorrow}` } : undefined,
      },
    }
  }

  if (slot.variant === 'return') {
    const desc = [slot.descLine1, slot.descLine2].filter(Boolean).join(' ')
    return {
      title,
      chips: [{ label: slot.returnChipLabel ?? '회차편', tone: 'warn' }],
      eta: {
        primary: { text: slot.time, tone: 'default' },
        secondary: desc ? { text: desc } : undefined,
      },
    }
  }

  if (slot.variant === 'frequent') {
    return {
      title,
      subtitle: slot.route,
      chips: [],
      eta: {
        primary: { text: slot.freqLabel, tone: 'default' },
        secondary: slot.freqSub ? { text: slot.freqSub } : undefined,
      },
    }
  }

  // normal
  const etaText = slot.imminentLabel ?? formatWait(slot.minutes, slot.departAt)
  return {
    title,
    subtitle: slot.route,
    // 막차 강조 — /shuttle/next의 is_last를 그대로 칩으로. 밤에 이 카드를 여는
    // 이유의 대부분이 "이게 막차인가"라서 상시 노출 가치가 있다.
    chips: slot.isLast ? [{ label: '막차', tone: 'warn' }] : [],
    eta: {
      primary: { text: etaText, tone: slot.isUrgent ? 'imminent' : slot.minutes == null ? 'muted' : 'default' },
      secondary: slot.nextMinutes != null
        ? { text: `다음 ${formatWait(slot.nextMinutes, slot.nextDepartAt)}` }
        : undefined,
    },
  }
}

// 60분을 넘는 대기를 분으로 말하면 읽히지 않는다. 새벽에 홈을 열면 "511분"이
// 찍혔다. utils/eta.js 가 정한 규칙(60분 초과면 상대 분 대신 절대 시각)을 그대로
// 따르되, 시간표 데이터라 예정 출발 시각(depart_at)을 이미 알고 있으므로
// now + 남은초로 되짚지 않고 그 값을 쓴다. 렌더 중 Date.now() 를 부르지 않아도 되고
// 반올림 오차도 안 생긴다.
const LONG_WAIT_MIN = 60

function formatWait(minutes, departAt) {
  if (minutes == null) return '정보 없음'
  if (minutes > LONG_WAIT_MIN && departAt) return departAt
  return `${minutes}분`
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
      departAt: data.depart_at ? data.depart_at.slice(0, 5) : null,
      nextDepartAt: data.next_depart_at ? data.next_depart_at.slice(0, 5) : null,
      imminentLabel: imminent ? '곧 출발' : null,
      isUrgent: imminent || (minutes != null && minutes <= SOON_THRESHOLD_MIN),
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
    departAt: data.depart_at ? data.depart_at.slice(0, 5) : null,
    nextDepartAt: data.next_depart_at ? data.next_depart_at.slice(0, 5) : null,
    imminentLabel: imminent ? '곧 출발' : null,
    isUrgent: imminent || (minutes != null && minutes <= SOON_THRESHOLD_MIN),
    isLast: data.is_last === true,
  }
}
