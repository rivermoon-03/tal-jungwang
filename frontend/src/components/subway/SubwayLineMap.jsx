import useAppStore from '../../stores/useAppStore'
import { TrainFront } from 'lucide-react'

// 방향별 역 목록 (열차 진행 방향 순서)
const STATION_SEQUENCES = {
  '4호선': {
    상행: ['오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '상록수', '반월', '대야미', '수리산', '산본', '금정', '범계', '평촌', '인덕원', '정부과천청사', '과천', '대공원', '경마공원', '선바위', '남태령', '사당', '총신대입구(이수)', '동작', '이촌', '신용산', '삼각지', '숙대입구', '서울역', '회현', '명동', '충무로', '동대문역사문화공원', '동대문', '혜화', '한성대입구', '성신여대입구', '길음', '미아사거리', '미아', '수유', '쌍문', '창동', '노원', '상계', '불암산', '별내별가람', '오남', '진접'],
    하행: ['진접', '오남', '별내별가람', '불암산', '상계', '노원', '창동', '쌍문', '수유', '미아', '미아사거리', '길음', '성신여대입구', '한성대입구', '혜화', '동대문', '동대문역사문화공원', '충무로', '명동', '회현', '서울역', '숙대입구', '삼각지', '신용산', '이촌', '동작', '총신대입구(이수)', '사당', '남태령', '선바위', '경마공원', '대공원', '과천', '정부과천청사', '인덕원', '평촌', '범계', '금정', '산본', '수리산', '대야미', '반월', '상록수', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도'],
  },
  '수인분당선': {
    상행: ['인천', '신포', '숭의', '인하대', '학익', '송도', '연수', '원인재', '남동인더스파크', '호구포', '인천논현', '소래포구', '월곶', '달월', '오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '사리', '야목', '어천', '오목천', '고색', '수원', '매교', '수원시청', '매탄권선', '망포', '영통', '청명', '상갈', '기흥', '신갈', '구성', '보정', '죽전', '오리', '미금', '정자', '수내', '서현', '이매', '야탑', '모란', '태평', '가천대', '복정', '수서', '대모산입구', '개포동', '구룡', '도곡', '한티', '선릉', '선정릉', '강남구청', '압구정로데오', '서울숲', '왕십리', '청량리'],
    하행: ['청량리', '왕십리', '서울숲', '압구정로데오', '강남구청', '선정릉', '선릉', '한티', '도곡', '구룡', '개포동', '대모산입구', '수서', '복정', '가천대', '태평', '모란', '야탑', '이매', '서현', '수내', '정자', '미금', '오리', '죽전', '보정', '구성', '신갈', '기흥', '상갈', '청명', '영통', '망포', '매탄권선', '수원시청', '매교', '수원', '고색', '오목천', '어천', '야목', '사리', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도', '달월', '월곶', '소래포구', '인천논현', '호구포', '남동인더스파크', '원인재', '연수', '송도', '학익', '인하대', '숭의', '신포', '인천'],
  },
  '서해선': {
    상행: ['원시', '시우', '초지', '선부', '달미', '시흥능곡', '시흥시청', '신현', '신천', '시흥대야', '소새울', '소사', '부천종합운동장', '원종', '김포공항', '능곡', '대곡', '곡산', '백마', '풍산', '일산'],
    하행: ['일산', '풍산', '백마', '곡산', '대곡', '능곡', '김포공항', '원종', '부천종합운동장', '소사', '소새울', '시흥대야', '신천', '신현', '시흥시청', '시흥능곡', '달미', '선부', '초지', '시우', '원시'],
  },
}

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
  const PAST_COLOR = darkMode ? '#4b5563' /* mute-2-dark */ : '#cbd2db' /* mute-2 */
  const FUTURE_COLOR = darkMode ? '#6b7280' /* mute-dark */ : '#94a3b8' /* mute */

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-card mx-4 mb-4 shadow-card overflow-hidden">
      <div className="px-4 pt-3.5 pb-1.5">
        <span className="text-meta font-bold text-mute dark:text-mute-dark uppercase tracking-wider">노선도</span>
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
                    className="flex items-center justify-center rounded-full bg-surface dark:bg-surface-dark z-10"
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
                    className="rounded-full flex-shrink-0 border-2 border-white dark:border-surface-dark z-0"
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
                      ? 'text-[15px] font-black tracking-tight'
                      : isTrain
                        ? 'text-[14px] font-extrabold tracking-tight'
                        : 'text-meta font-semibold'
                  } ${
                    isView
                      ? 'text-ink dark:text-ink-dark'
                      : isTrain
                        ? 'text-imminent dark:text-imminent-dark'
                        : isPast
                          ? 'text-mute-2 dark:text-mute-2-dark'
                          : 'text-mute dark:text-mute-dark'
                  }`}
                  style={isView ? { color } : {}}
                >
                  {stationName}
                </span>
                {isView && (
                  <span className="text-chip font-extrabold px-2 py-0.5 rounded-chip text-white" style={{ background: color }}>
                    현위치
                  </span>
                )}
                {isTrain && (
                  <span className="text-chip font-extrabold text-white bg-imminent dark:bg-imminent-dark px-2 py-0.5 rounded-full">
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
