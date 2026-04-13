import { toMin, getBoardingStatus } from '../../utils/boardingStatus'
import { useShuttleSchedule } from '../../hooks/useShuttle'
import { useBusTimetableByRoute } from '../../hooks/useBus'
import { useTaxiToStation } from '../../hooks/useRoute'
import { getSpecialTrainIndices } from '../../utils/trainTime'

// TODO: GBIS 실시간 연동 시 정류장 ID 채울 것 (현재는 시간표 기반으로 표시)
export const SEOUL_STATION_ID = null

// ── 공통 유틸 ──────────────────────────────────────────────────────────────

/** depart_at("HH:MM") → 현재로부터 남은 분 (초 정밀도로 계산 후 floor). 이미 지났으면 null */
function minsUntilDepart(departAt) {
  if (!departAt) return null
  const [hh, mm] = departAt.split(':').map(Number)
  const now = new Date()
  const diffSec = (hh * 3600 + mm * 60) - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
  return diffSec > 0 ? Math.floor(diffSec / 60) : null
}

/** 시간표 times 배열에서 다음 2개 출발 시간 반환 */
function getUpcomingTwo(times = []) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return times
    .filter((t) => {
      const [hh, mm] = t.split(':').map(Number)
      return hh * 60 + mm > nowMin
    })
    .slice(0, 2)
    .map((t) => {
      const [hh, mm] = t.split(':').map(Number)
      const diffMin = hh * 60 + mm - nowMin
      return { time: t, diffMin }
    })
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────────────────

function isLastTrain(trains) {
  if (!trains?.length) return false
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const { lastIdx } = getSpecialTrainIndices(trains)
  if (lastIdx === null) return false
  const nextIdx = trains.findIndex((t) => {
    const [hh, mm] = t.depart_at.split(':').map(Number)
    return hh * 60 + mm > nowMin
  })
  return nextIdx >= 0 && nextIdx === lastIdx
}

function LastBadge() {
  return (
    <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">
      막차
    </span>
  )
}

function SubwaySection({ subwayData, timetableData }) {
  if (!subwayData) {
    return <p className="text-xs text-slate-400">지하철 정보 없음</p>
  }
  const { up, down, line4_up, line4_down } = subwayData
  const isLast = {
    up:         timetableData ? isLastTrain(timetableData.up)        : false,
    down:       timetableData ? isLastTrain(timetableData.down)      : false,
    line4_up:   timetableData ? isLastTrain(timetableData.line4_up)  : false,
    line4_down: timetableData ? isLastTrain(timetableData.line4_down): false,
  }
  return (
    <div className="flex flex-col gap-2">
      {/* 수인분당선 */}
      <div className="bg-orange-50 dark:bg-orange-950/40 border-l-[3px] border-amber-400 rounded-md px-3 py-2.5">
        <p className="text-base font-extrabold text-amber-600 dark:text-amber-400 mb-1.5">수인분당선</p>
        <div className="flex justify-between items-center text-base text-slate-500 dark:text-slate-400">
          <span>{up?.destination ? `${up.destination} 방면` : '왕십리 방면'}</span>
          <div className="flex items-center gap-1.5">
            {isLast.up && <LastBadge />}
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {up ? `${minsUntilDepart(up.depart_at) ?? '—'}분` : '종료'}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center text-base text-slate-500 dark:text-slate-400">
          <span>{down?.destination ? `${down.destination} 방면` : '인천(오이도) 방면'}</span>
          <div className="flex items-center gap-1.5">
            {isLast.down && <LastBadge />}
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {down ? `${minsUntilDepart(down.depart_at) ?? '—'}분` : '종료'}
            </span>
          </div>
        </div>
      </div>
      {/* 4호선 */}
      <div className="bg-blue-50 dark:bg-blue-950/40 border-l-[3px] border-blue-600 rounded-md px-3 py-2.5">
        <p className="text-base font-extrabold text-blue-700 dark:text-blue-400 mb-1.5">4호선</p>
        <div className="flex justify-between items-center text-base text-slate-500 dark:text-slate-400">
          <span>{line4_up?.destination ? `${line4_up.destination} 방면` : '당고개 방면'}</span>
          <div className="flex items-center gap-1.5">
            {isLast.line4_up && <LastBadge />}
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {line4_up ? `${minsUntilDepart(line4_up.depart_at) ?? '—'}분` : '종료'}
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center text-base text-slate-500 dark:text-slate-400">
          <span>{line4_down?.destination ? `${line4_down.destination} 방면` : '오이도 방면'}</span>
          <div className="flex items-center gap-1.5">
            {isLast.line4_down && <LastBadge />}
            <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {line4_down ? `${minsUntilDepart(line4_down.depart_at) ?? '—'}분` : '종료'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function BusRow({ arrival, walkSec }) {
  if (arrival.arrival_type === 'timetable') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white bg-slate-500 px-2 py-0.5 rounded min-w-[40px] text-center">{arrival.route_no}</span>
        <span className="flex-1 text-sm text-slate-500 dark:text-slate-400">{arrival.destination}</span>
        <span className="text-sm text-slate-600 dark:text-slate-300">{arrival.depart_at} 출발</span>
      </div>
    )
  }
  const min = toMin(arrival.arrive_in_seconds)
  if (min == null) return null
  const status = getBoardingStatus(arrival.arrive_in_seconds, walkSec)
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-bold text-white bg-navy px-2 py-0.5 rounded min-w-[40px] text-center">{arrival.route_no}</span>
      <span className="flex-1 text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">{min === 0 ? '곧 출발' : `${min}분 후`}</span>
      <span className="text-sm px-2 py-0.5 rounded font-semibold" style={{ background: status.bg, color: status.color }}>{status.label}</span>
      <span className="text-xs text-blue-500 font-semibold whitespace-nowrap">±2분 | 테스트 중</span>
    </div>
  )
}

/** 시간표 기반 노선 카드 (3400·6502) */
function TimetableRouteCard({ routeNumber }) {
  const { data, loading } = useBusTimetableByRoute(routeNumber)

  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2.5">
        <p className="text-sm font-bold text-slate-400">{routeNumber}번</p>
        <p className="text-base text-slate-400 mt-0.5">불러오는 중...</p>
      </div>
    )
  }

  const upcoming = data ? getUpcomingTwo(data.times) : []

  return (
    <div className="bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-sm font-bold text-white bg-red-600 px-2 py-0.5 rounded">{routeNumber}</span>
        <span className="text-xs text-slate-400">번 버스</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-base text-slate-400">오늘 남은 출발 없음</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {upcoming.map(({ time, diffMin }, i) => (
            <div key={time} className="flex justify-between items-center">
              <span className="text-sm text-slate-400">{i === 0 ? '다음' : '그 다음'}</span>
              <span className="text-base tabular-nums">
                <span className="font-bold text-slate-900 dark:text-slate-100">{time}</span>
                <span className="text-slate-400 ml-1.5">{diffMin}분 후</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 탭 콘텐츠 컴포넌트 ─────────────────────────────────────────────────────

function JeongwangTab({ subwayData, busJeongwangData, walkTimes, timetableData, onNavigate }) {
  const { data: taxiData } = useTaxiToStation()

  const arrivals = busJeongwangData?.arrivals?.filter(
    (a) => a.route_no === '20-1' || a.route_no === '33'
  ) ?? []

  const taxiMin = taxiData?.duration_seconds != null
    ? Math.ceil(taxiData.duration_seconds / 60)
    : null

  const clickable = onNavigate
    ? 'cursor-pointer hover:opacity-80 transition-opacity'
    : ''

  return (
    <div className="flex flex-col gap-2">
      <div className={clickable} onClick={onNavigate ? () => onNavigate('subway') : undefined}>
        <SubwaySection subwayData={subwayData} timetableData={timetableData} />
      </div>
      {arrivals.length > 0 && (
        <div
          className={`bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2 flex flex-col gap-1.5 ${clickable}`}
          onClick={onNavigate ? () => onNavigate('bus') : undefined}
        >
          <p className="text-[12px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">버스 (정왕역 방면)</p>
          {arrivals.map((a, i) => (
            <BusRow key={`${a.route_no}-${i}`} arrival={a} walkSec={walkTimes.bus} />
          ))}
        </div>
      )}
      {/* 택시 */}
      <div className="bg-green-50 dark:bg-green-950/40 border-l-[3px] border-green-500 rounded-md px-3 py-2">
        <p className="text-[12px] font-bold text-green-800 dark:text-green-400 mb-1">택시</p>
        <div className="flex justify-between text-[13px] text-slate-500 dark:text-slate-400">
          <span>학교 → 정왕역</span>
          <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {taxiMin != null ? `약 ${taxiMin}분` : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}

function SeoulTab({ onNavigate }) {
  const clickable = onNavigate ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
  return (
    <div className="flex flex-col gap-2">
      <div className={clickable} onClick={onNavigate ? () => onNavigate('bus') : undefined}>
        <TimetableRouteCard routeNumber="3400" />
      </div>
      <div className={clickable} onClick={onNavigate ? () => onNavigate('bus') : undefined}>
        <TimetableRouteCard routeNumber="6502" />
      </div>
      {/* TODO: 시흥1 (서해선 신천역 방면) — 카테고리 미정, 추후 추가 */}
    </div>
  )
}

function ShuttleSection({ onNavigate }) {
  const { data: schedule, loading } = useShuttleSchedule()

  if (loading) return <p className="text-xs text-slate-400">불러오는 중...</p>
  if (!schedule?.directions?.length) return <p className="text-xs text-slate-400">셔틀 정보 없음</p>

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  return (
    <div className="flex flex-col gap-2">
      {schedule.directions.map(({ direction, times }) => {
        const upcoming = times
          .filter((t) => {
            const [hh, mm] = t.depart_at.split(':').map(Number)
            return hh * 60 + mm > nowMin
          })
          .slice(0, 2)

        return (
          <div
            key={direction}
            className={`bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md px-3 py-2.5 ${onNavigate ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
            onClick={onNavigate ? () => onNavigate('shuttle') : undefined}
          >
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-1.5">{direction}</p>
            {upcoming.length === 0 ? (
              <p className="text-base text-slate-400">오늘 남은 셔틀 없음</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {upcoming.map((t, i) => {
                  const [hh, mm] = t.depart_at.split(':').map(Number)
                  const diffMin = hh * 60 + mm - nowMin
                  return (
                    <div key={t.depart_at} className="flex justify-between items-center">
                      <span className="text-sm text-slate-400">{i === 0 ? '다음' : '그 다음'}</span>
                      <span className="text-base tabular-nums">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{t.depart_at}</span>
                        <span className="text-slate-400 ml-1.5">{diffMin}분 후</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 탭 목록 및 메인 컴포넌트 ──────────────────────────────────────────────

const TABS = [
  { id: 'jeongwang', label: '정왕역' },
  { id: 'seoul',     label: '서울' },
  { id: 'shuttle',   label: '셔틀' },
  // { id: 'siheung', label: '시흥시청' }, // 추후 추가
]

const TAB_MAIN_MAP = {
  jeongwang: 'subway',
  seoul:     'bus',
  shuttle:   'shuttle',
}

export default function InfoPanelTabs({ tab, setTab, subwayData, busJeongwangData, walkTimes, timetableData, onNavigate }) {
  return (
    <div className="flex flex-col gap-2">
      {/* 탭 토글 */}
      <div className="flex gap-1.5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
              tab === id
                ? 'bg-navy text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'jeongwang' && (
        <JeongwangTab subwayData={subwayData} busJeongwangData={busJeongwangData} walkTimes={walkTimes} timetableData={timetableData} onNavigate={onNavigate} />
      )}
      {tab === 'seoul' && <SeoulTab onNavigate={onNavigate} />}
      {tab === 'shuttle' && <ShuttleSection onNavigate={onNavigate} />}

      {/* 전체 시간표 이동 */}
      {onNavigate && (
        <button
          onClick={() => onNavigate(TAB_MAIN_MAP[tab])}
          className="mt-1 self-end flex items-center gap-1 text-[13px] font-bold text-navy dark:text-blue-300 pressable"
        >
          전체 시간표 보기 →
        </button>
      )}
    </div>
  )
}
