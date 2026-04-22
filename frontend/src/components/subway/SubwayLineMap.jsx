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

export default function SubwayLineMap({ line, direction, currentStation, terminalStation, color, viewStation = '정왕' }) {
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

  const viewIdx = findStationIdx(viewStation)
  const currentIdx = findStationIdx(currentStation)

  // 노선도 노출 범위 계산 (열차가 오는 방향 중심 - 15정거장 확보)
  // 매칭 실패 시(viewIdx === -1) 열차 위치라도 기준으로 삼아 노선도가 통째로 잘리는 것을 방지
  const safeViewIdx = viewIdx !== -1 ? viewIdx : (currentIdx !== -1 ? currentIdx : Math.floor(stations.length / 2))
  
  const startIdx = Math.max(0, currentIdx !== -1 
    ? Math.min(currentIdx, safeViewIdx - 15) 
    : safeViewIdx - 15
  )
  
  const endIdx = Math.min(stations.length - 1, currentIdx !== -1
    ? Math.max(safeViewIdx + 1, currentIdx)
    : safeViewIdx + 1
  )

  const visible = stations.slice(startIdx, endIdx + 1)
  const visibleStart = startIdx

  return (
    <div className="bg-white dark:bg-surface-dark rounded-xl mx-4 mb-4 border border-slate-100 dark:border-border-dark overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">노선도</span>
      </div>
      <div className="px-4 pb-3">
        {visible.map((stationName, i) => {
          const absoluteIdx = visibleStart + i
          const isView  = absoluteIdx === viewIdx
          const isTrain = absoluteIdx === currentIdx && currentIdx !== -1
          const isPast = currentIdx !== -1 && absoluteIdx < currentIdx

          return (
            <div key={absoluteIdx} className="flex items-center gap-0">
              {/* 세로 선 + 역 dot */}
              <div className="flex flex-col items-center w-5 flex-shrink-0">
                {/* 위 선 */}
                {i > 0 && (
                  <div
                    className="w-0.5 h-3"
                    style={{ background: isPast ? (darkMode ? '#334155' : '#e2e8f0') : color, opacity: isPast ? 0.4 : 1 }}
                  />
                )}
                {/* 역 dot */}
                {isTrain ? (
                  <div
                    className="flex items-center justify-center rounded-full bg-white dark:bg-surface-dark z-10"
                    style={{
                      width: 24,
                      height: 24,
                      boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)',
                      border: '2px solid #f59e0b',
                      color: '#f59e0b'
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
                          ? (darkMode ? '#334155' : '#e2e8f0')
                          : (darkMode ? '#475569' : '#cbd5e1'),
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
                        ? (darkMode ? '#334155' : '#e2e8f0')
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
                      ? 'text-sm font-extrabold'
                      : isTrain
                        ? 'text-sm font-bold'
                        : 'text-xs'
                  } ${
                    isView
                      ? 'text-slate-900 dark:text-slate-100'
                      : isTrain
                        ? 'text-amber-600 dark:text-amber-400'
                        : isPast
                          ? 'text-slate-300 dark:text-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                  }`}
                  style={isView ? { color } : {}}
                >
                  {stationName}
                </span>
                {isView && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: color }}>
                    현위치
                  </span>
                )}
                {isTrain && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    🚇 접근 중
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
