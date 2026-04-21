import { useMemo } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useShuttleNext, useShuttleSchedule } from '../../hooks/useShuttle'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import DualDirectionCard from '../common/DualDirectionCard'

/**
 * ShuttlePanel — 셔틀 모드 패널.
 *
 * 한 카드 안에 등교 / 하교를 듀얼 컬럼으로. 캠퍼스(본캠/2캠) 선택에 따라
 *   본캠: direction 0(등교) + 1(하교)
 *   2캠 : direction 2(등교) + 3(하교)
 *
 * 좌측=등교 클릭 → 등교 방향 모달, 우측=하교 클릭 → 하교 방향 모달.
 * 운행 종료 시 내일(또는 다음 운행일) 첫차 시간 표시.
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

export default function ShuttlePanel() {
  const campus = useAppStore((s) => s.selectedShuttleCampus)
  const setDetailModal = useAppStore((s) => s.setDetailModal)

  const [goDir, backDir] = campus === 'second' ? [2, 3] : [0, 1]
  const goQuery = useShuttleNext(goDir)
  const backQuery = useShuttleNext(backDir)

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
        <Skeleton height="5.5rem" rounded="rounded-xl" />
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

  const left = toSlot(goData, goDir, goFirstTomorrow)
  const right = toSlot(backData, backDir, backFirstTomorrow)

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

  return (
    <div className="space-y-2">
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

function toSlot(data, direction, firstTomorrow = null) {
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

  if (isFrequent) {
    return {
      variant: 'frequent',
      dir: dirText,
      route: `${meta.origin} → ${meta.dest}`,
      freqLabel: '수시운행',
      freqSub: '약 10분 간격',
    }
  }

  const minutes = data.arrive_in_seconds != null
    ? Math.max(0, Math.ceil(data.arrive_in_seconds / 60))
    : null
  const nextMinutes = data.next_arrive_in_seconds != null
    ? Math.max(0, Math.ceil(data.next_arrive_in_seconds / 60))
    : null

  return {
    variant: 'normal',
    dir: dirText,
    route: `${meta.origin} → ${meta.dest}`,
    minutes,
    nextMinutes,
    isUrgent: minutes != null && minutes <= 3,
  }
}
