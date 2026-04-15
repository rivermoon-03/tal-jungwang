import { TramFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import { formatArrival } from '../../utils/arrivalTime'

const STATIONS = ['정왕', '초지', '시흥시청']

/**
 * 역별 데이터 키 매핑
 *   정왕: 수인분당선(up/down) + 4호선(line4_up/line4_down)
 *   초지: 서해선(choji_up/choji_dn)
 *   시흥시청: 서해선(siheung_up/siheung_dn)
 */
const STATION_LINES = {
  정왕: [
    { label: '수인분당선 상행', upKey: 'up',         downKey: 'down',       color: '#F5A623' },
    { label: '4호선 상행',    upKey: 'line4_up',    downKey: 'line4_down', color: '#1B5FAD' },
  ],
  초지: [
    { label: '서해선 상행',   upKey: 'choji_up',   downKey: 'choji_dn',   color: '#75bf43' },
  ],
  시흥시청: [
    { label: '서해선 상행',   upKey: 'siheung_up', downKey: 'siheung_dn', color: '#75bf43' },
  ],
}

export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const setSubwayStation = useAppStore((s) => s.setSubwayStation)
  const { data, loading, error, refetch } = useSubwayNext()

  const lines = STATION_LINES[selectedStation] ?? []

  // 선택된 역의 모든 방향 키에 데이터가 전혀 없는지 확인
  const hasAnyData = data && lines.some(
    (l) => data[l.upKey] != null || data[l.downKey] != null
  )

  return (
    <div className="space-y-3">
      {/* 역 pill 탭 */}
      <div className="flex gap-2 flex-wrap">
        {STATIONS.map((st) => {
          const isActive = selectedStation === st
          return (
            <button
              key={st}
              onClick={() => setSubwayStation(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors
                ${isActive
                  ? 'shadow-sm'
                  : 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-coral/60'
                }`}
              style={isActive ? { background: '#FF385C', color: '#FFFFFF' } : undefined}
            >
              {st}
            </button>
          )
        })}
      </div>

      {/* 콘텐츠 */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton height="2.5rem" rounded="rounded-xl" />
          <Skeleton height="2.5rem" rounded="rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState message="지하철 정보를 불러오지 못했어요" onRetry={refetch} />
      ) : !data || lines.length === 0 ? (
        <EmptyState title="정보 준비 중" desc={`${selectedStation}역 정보를 준비하고 있어요.`} className="py-6" />
      ) : !hasAnyData ? (
        <EmptyState title="🌙 운행 종료" desc="내일 첫차 시간을 확인하세요" className="py-6" />
      ) : (
        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.upKey} className="space-y-1.5">
              {/* 노선 레이블 */}
              <div className="flex items-center gap-1.5 px-0.5">
                <span
                  className="inline-flex w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: line.color }}
                />
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  {line.label.replace(' 상행', '')}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <TrainCard label="상행" train={data[line.upKey]} lineColor={line.color} />
                <TrainCard label="하행" train={data[line.downKey]} lineColor={line.color} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrainCard({ label, train, lineColor }) {
  // 백엔드 응답: { depart_at: "HH:MM", arrive_in_seconds: int, destination: string }
  // arrive_in_seconds가 60분 초과이면 Date.now() drift 방지를 위해 depart_at 직접 사용
  const arrivalStr = train
    ? (train.arrive_in_seconds != null && train.arrive_in_seconds <= 3600
        ? formatArrival(train.arrive_in_seconds)
        : train.depart_at ?? '–')
    : null

  return (
    <div className="bg-suinbundang-light dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <TramFront size={14} style={{ color: lineColor }} className="shrink-0" aria-hidden="true" />
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      {train ? (
        <>
          <p className="text-lg font-black text-gray-900 dark:text-gray-50 leading-none">
            {arrivalStr}
          </p>
          {train.destination && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400">{train.destination} 방향</p>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-400">정보 없음</p>
      )}
    </div>
  )
}
