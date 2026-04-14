import { TramFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayNext } from '../../hooks/useSubway'
import Skeleton from '../common/Skeleton'
import ErrorState from '../common/ErrorState'
import EmptyState from '../common/EmptyState'
import { formatArrival } from '../../utils/arrivalTime'

const STATIONS = ['정왕', '초지', '시흥시청']

/**
 * SubwayPanel — 지하철 모드 패널
 * 역 pill 3개 + 선택된 역의 상/하행 다음 열차 1개씩
 *
 * useSubwayNext() 반환 shape (추정):
 *   data: { up: { time, dest, minutesLeft }, down: { time, dest, minutesLeft } } | null
 */
export default function SubwayPanel() {
  const selectedStation = useAppStore((s) => s.selectedSubwayStation)
  const setSubwayStation = useAppStore((s) => s.setSubwayStation)

  // 현재 정왕역만 실시간 API가 있음; 다른 역은 EmptyState로 안내
  const isJeongwang = selectedStation === '정왕'
  const { data, loading, error, refetch } = useSubwayNext()

  return (
    <div className="space-y-3">
      {/* 역 pill 탭 */}
      <div className="flex gap-2 flex-wrap">
        {STATIONS.map((st) => (
          <button
            key={st}
            onClick={() => setSubwayStation(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-pill transition-colors
              ${selectedStation === st
                ? 'bg-coral text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {!isJeongwang ? (
        <EmptyState
          title={`${selectedStation} 역 정보 준비 중`}
          desc="현재 정왕역만 실시간 정보가 제공됩니다."
          className="py-6"
        />
      ) : loading ? (
        <div className="space-y-2">
          <Skeleton height="2.5rem" rounded="rounded-xl" />
          <Skeleton height="2.5rem" rounded="rounded-xl" />
        </div>
      ) : error ? (
        <ErrorState message="지하철 정보를 불러오지 못했어요" onRetry={refetch} />
      ) : !data ? (
        <EmptyState title="🌙 운행 종료" desc="내일 첫차 시간을 확인하세요" className="py-6" />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <TrainCard label="상행" train={data.up} />
          <TrainCard label="하행" train={data.down} />
        </div>
      )}
    </div>
  )
}

function TrainCard({ label, train }) {
  // 백엔드 응답: { depart_at: "HH:MM", arrive_in_seconds: int, destination: string }
  const arrivalStr = train ? formatArrival(train.arrive_in_seconds) ?? train.depart_at ?? '–' : null

  return (
    <div className="bg-suinbundang-light dark:bg-gray-700/50 rounded-xl p-3 flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <TramFront size={14} className="text-suinbundang shrink-0" aria-hidden="true" />
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
