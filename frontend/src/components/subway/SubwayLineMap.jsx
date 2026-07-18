import useAppStore from '../../stores/useAppStore'
import { TrainFront } from 'lucide-react'
import { STATION_SEQUENCES } from '../../utils/subwayStations'

export default function SubwayLineMap({ line, direction, currentStation, terminalStation, color, viewStation = '정왕', trains = null }) {
  const darkMode = useAppStore((s) => s.darkMode)
  const stations = STATION_SEQUENCES[line]?.[direction] ?? []

  if (stations.length === 0) return null

  const findStationIdx = (name) => {
    if (!name) return -1
    // 1. 정확히 일치하는 경우
    const exact = stations.indexOf(name)
    if (exact !== -1) return exact

    // 2. '역' 자를 떼거나 붙여서 일치하는 경우
    const normalized = name.endsWith('역') ? name.slice(0, -1) : name
    return stations.findIndex(s => s === normalized || s === normalized + '역')
  }

  // trains 배열이 주어지면 다중 열차 모드, 아니면 legacy 단일 currentStation.
  const trainList = Array.isArray(trains) && trains.length > 0
    ? trains
    : (currentStation ? [{ current_station: currentStation, destination: terminalStation }] : [])
  const trainIndices = trainList
    .map((t) => findStationIdx(t.current_station))
    .filter((i) => i !== -1)
  const trainIdxByStation = new Map()
  trainList.forEach((t) => {
    const idx = findStationIdx(t.current_station)
    if (idx !== -1 && !trainIdxByStation.has(idx)) trainIdxByStation.set(idx, t)
  })

  const viewIdx = findStationIdx(viewStation)
  const minTrainIdx = trainIndices.length > 0 ? Math.min(...trainIndices) : -1
  const maxTrainIdx = trainIndices.length > 0 ? Math.max(...trainIndices) : -1

  // 노선도 노출 범위 계산 (열차가 오는 방향 중심 - 15정거장 확보)
  // 매칭 실패 시(viewIdx === -1) 열차 위치라도 기준으로 삼아 노선도가 통째로 잘리는 것을 방지
  const safeViewIdx = viewIdx !== -1 ? viewIdx : (minTrainIdx !== -1 ? minTrainIdx : Math.floor(stations.length / 2))

  const startIdx = Math.max(0, minTrainIdx !== -1
    ? Math.min(minTrainIdx, safeViewIdx - 15)
    : safeViewIdx - 15
  )

  const endIdx = Math.min(stations.length - 1, maxTrainIdx !== -1
    ? Math.max(safeViewIdx + 1, maxTrainIdx)
    : safeViewIdx + 1
  )

  // 같은 방향에 destination이 여러 종류면 dot 옆에 행선 라벨을 붙여 구분.
  const uniqueDestinations = new Set(trainList.map((t) => t.destination).filter(Boolean))
  const showDestinationOnDot = uniqueDestinations.size > 1

  const visible = stations.slice(startIdx, endIdx + 1)
  const visibleStart = startIdx

  // 라인·도트의 회색 톤은 라이트/다크 모드별 mute 토큰값을 인라인 style로 사용
  const PAST_COLOR = darkMode ? '#4b5563' /* line-strong */ : '#cbd2db' /* line-strong */
  const FUTURE_COLOR = darkMode ? '#6b7280' /* mute */ : '#94a3b8' /* mute */

  return (
    <div className="bg-surface dark:bg-surface rounded-card mx-4 mb-4 shadow-card overflow-hidden">
      <div className="px-4 pt-3.5 pb-1.5">
        <span className="text-meta font-bold text-mute dark:text-mute uppercase tracking-wider">노선도</span>
      </div>
      <div className="px-4 pb-3">
        {visible.map((stationName, i) => {
          const absoluteIdx = visibleStart + i
          const isView  = absoluteIdx === viewIdx
          const isTrain = trainIdxByStation.has(absoluteIdx)
          const trainHere = isTrain ? trainIdxByStation.get(absoluteIdx) : null
          // 가장 뒤쪽 열차(minTrainIdx)보다 앞 정거장은 모든 접근 열차가 이미 지나간 자리
          // → past로 dim 처리. 열차 사이 정거장은 upcoming으로 남겨둠.
          const isPast = minTrainIdx !== -1 && absoluteIdx < minTrainIdx && !isTrain

          return (
            <div key={absoluteIdx} className="flex items-center gap-0">
              {/* 세로 선 + 역 dot */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                {/* 위 선 */}
                {i > 0 && (
                  <div
                    className="w-0.5 h-3"
                    style={{ background: isPast ? PAST_COLOR : color, opacity: isPast ? 0.4 : 1 }}
                  />
                )}
                {/* 역 dot */}
                {isTrain ? (
                  <div
                    className="flex items-center justify-center rounded-full bg-surface dark:bg-surface z-10"
                    style={{
                      width: 26,
                      height: 26,
                      boxShadow: '0 0 0 4px rgba(226, 106, 77, 0.18)',
                      border: '2px solid #e26a4d',
                      color: '#e26a4d',
                    }}
                  >
                    <TrainFront size={14} strokeWidth={2.5} />
                  </div>
                ) : (
                  <div
                    className="rounded-full flex-shrink-0 border-2 border-white dark:border-surface z-0"
                    style={{
                      width: isView ? 14 : 9,
                      height: isView ? 14 : 9,
                      background: isView
                        ? color
                        : isPast
                          ? PAST_COLOR
                          : FUTURE_COLOR,
                      outline: isView ? `2px solid ${color}` : 'none',
                      outlineOffset: 1,
                      opacity: isPast ? 0.35 : 1,
                    }}
                  />
                )}
                {/* 아래 선 */}
                {i < visible.length - 1 && (
                  <div
                    className="w-0.5 h-3"
                    style={{
                      background: isView || (viewIdx !== -1 && absoluteIdx >= viewIdx)
                        ? PAST_COLOR
                        : color,
                      opacity: isPast ? 0.4 : 1,
                    }}
                  />
                )}
              </div>

              {/* 역명 + 뱃지 */}
              <div className="flex items-center gap-2 ml-3 py-0.5">
                <span
                  className={`leading-none ${
                    isView
                      ? 'text-[15px] font-semibold tracking-tight'
                      : isTrain
                        ? 'text-[14px] font-semibold tracking-tight'
                        : 'text-meta font-semibold'
                  } ${
                    isView
                      ? 'text-ink dark:text-ink'
                      : isTrain
                        ? 'text-imminent dark:text-imminent'
                        : isPast
                          ? 'text-line-strong dark:text-line-strong'
                          : 'text-mute dark:text-mute'
                  }`}
                  style={isView ? { color } : {}}
                >
                  {stationName}
                </span>
                {isView && (
                  <span className="text-chip font-semibold px-2 py-0.5 rounded-chip text-white" style={{ background: color }}>
                    현위치
                  </span>
                )}
                {isTrain && (
                  <span className="text-chip font-semibold text-white bg-imminent dark:bg-imminent px-2 py-0.5 rounded-full">
                    {showDestinationOnDot && trainHere?.destination
                      ? `${trainHere.destination}행 접근`
                      : '접근 중'}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
