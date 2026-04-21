import useAppStore from '../../stores/useAppStore'
import { useShuttleNext } from '../../hooks/useShuttle'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import DualDirectionCard from '../common/DualDirectionCard'

/**
 * ShuttlePanel — 셔틀 모드 패널.
 *
 * 한 카드 안에 등교 / 하교를 듀얼 컬럼으로. 캠퍼스(본캠/2캠) 선택에 따라
 *   본캠: direction 0(등교) + 1(하교)
 *   2캠 : direction 2(등교) + 3(하교)
 */

// direction: 0=본캠 등교, 1=본캠 하교, 2=2캠 등교, 3=2캠 하교
const DIR_META = {
  0: { arrow: '↑', label: '등교', origin: '정왕역', dest: '본캠' },
  1: { arrow: '↓', label: '하교', origin: '본캠',   dest: '정왕역' },
  2: { arrow: '↑', label: '등교', origin: '본캠',   dest: '2캠' },
  3: { arrow: '↓', label: '하교', origin: '2캠',    dest: '본캠' },
}

// 회차편 원버스 출발지 — note가 "학교 HH:MM 출발"이므로 "학교"는
// direction=0일 땐 본캠, direction=2일 땐 2캠. 그 외 direction에선
// 현재 데이터상 회차편이 없으므로 기본값 "학교".
const RETURN_ORIGIN = { 0: '본캠', 2: '2캠' }

// 백엔드가 "해당 날짜에 운행이 없음"을 의미할 때 돌려주는 오류 코드.
// 이들은 에러가 아닌 Empty 상태로 표시한다.
const NO_RUN_CODES = new Set(['NO_SHUTTLE', 'NO_SCHEDULE'])

export default function ShuttlePanel() {
  const campus = useAppStore((s) => s.selectedShuttleCampus)
  const setDetailModal = useAppStore((s) => s.setDetailModal)

  const [goDir, backDir] = campus === 'second' ? [2, 3] : [0, 1]
  const goQuery = useShuttleNext(goDir)
  const backQuery = useShuttleNext(backDir)

  const anyLoading = goQuery.loading || backQuery.loading

  if (anyLoading && !goQuery.data && !backQuery.data) {
    return (
      <div className="space-y-2">
        <Skeleton height="5.5rem" rounded="rounded-xl" />
      </div>
    )
  }

  const goData = normalizeData(goQuery)
  const backData = normalizeData(backQuery)

  // 두 방향 모두 진짜 에러(NO_RUN이 아닌)인 경우에만 ErrorState.
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

  const left = toSlot(goData, goDir)
  const right = toSlot(backData, backDir)

  const handleClick = () => {
    // 어느 방향이 더 임박한지 기준으로 모달 대상을 고른다.
    // 둘 다 미운행인 경우엔 기본값 등교로.
    const target = pickPrimaryDirection(goData, backData, goDir, backDir)
    const meta = DIR_META[target]
    const campusTag = target >= 2 ? '2캠 ' : ''
    setDetailModal({
      type: 'shuttle',
      routeCode: `${campusTag}셔틀${meta.label}`,
      direction: target,
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
        onClick={handleClick}
      />
    </div>
  )
}

/**
 * useApi 훅 결과에서 운행 데이터만 꺼낸다. NO_RUN 에러는 data 없음으로 취급.
 */
function normalizeData(query) {
  if (query.data) return query.data
  if (query.error && NO_RUN_CODES.has(query.error.code)) return null
  return null
}

/**
 * 방향 데이터 → DirectionSlot.
 *   - note '수시운행' → frequent
 *   - note '회차편 포함' → return
 *   - 그 외 → normal
 *   - depart_at 없음 → empty
 */
function toSlot(data, direction) {
  const meta = DIR_META[direction]
  if (!meta) return { variant: 'empty' }
  const dirText = `${meta.arrow} ${meta.label}`
  if (!data?.depart_at) return { variant: 'empty' }

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

/**
 * 카드 클릭 시 모달에 띄울 기본 방향 결정.
 * - 둘 다 운행 중이면 arrive_in_seconds가 더 작은 쪽(더 임박).
 * - 한쪽만 운행 중이면 그쪽.
 * - 둘 다 미운행이면 등교 방향 기본.
 */
function pickPrimaryDirection(goData, backData, goDir, backDir) {
  const goSec = goData?.arrive_in_seconds
  const backSec = backData?.arrive_in_seconds
  if (goSec != null && backSec != null) {
    return goSec <= backSec ? goDir : backDir
  }
  if (goData?.depart_at) return goDir
  if (backData?.depart_at) return backDir
  return goDir
}
