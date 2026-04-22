import useAppStore from '../../stores/useAppStore'

// 방향별 역 목록 (열차 진행 방향 순서)
const STATION_SEQUENCES = {
  '4호선': {
    상행: ['오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '상록수', '반월', '대야미', '수리산', '산본', '금정'],
    하행: ['금정', '산본', '수리산', '대야미', '반월', '상록수', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도'],
  },
  '수인분당선': {
    상행: ['소래포구', '월곶', '달월', '오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '사리', '야목', '어천', '오목천', '고색', '수원'],
    하행: ['수원', '고색', '오목천', '어천', '야목', '사리', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도', '달월', '월곶', '소래포구'],
  },
  '서해선': {
    상행: ['원시', '시우', '초지', '달월', '시흥능곡', '시흥시청', '신현', '신천', '시흥대야', '소새울', '소사', '부천종합운동장', '원종', '김포공항', '능곡', '대곡', '곡산', '백마', '풍산', '일산'],
    하행: ['일산', '풍산', '백마', '곡산', '대곡', '능곡', '김포공항', '원종', '부천종합운동장', '소사', '소새울', '시흥대야', '신천', '신현', '시흥시청', '시흥능곡', '달월', '초지', '시우', '원시'],
  },
}

export default function SubwayLineMap({ line, direction, currentStation, terminalStation, color, viewStation = '정왕' }) {
  const darkMode = useAppStore((s) => s.darkMode)
  const stations = STATION_SEQUENCES[line]?.[direction] ?? []

  if (stations.length === 0) return null

  const viewIdx = stations.indexOf(viewStation)
  const currentIdx = stations.indexOf(currentStation)
  const trainApproaching = currentIdx !== -1 && viewIdx !== -1 && currentIdx < viewIdx

  // 표시할 역 범위: 열차 위치(또는 viewStation) 기준 앞 4개, viewStation 뒤 2개
  const terminalIdx = terminalStation ? stations.indexOf(terminalStation) : -1
  const anchorIdx = viewIdx !== -1 ? viewIdx : 0
  const startIdx = Math.max(0, Math.min(currentIdx !== -1 ? currentIdx : anchorIdx, anchorIdx) - 4)
  const endIdx = Math.min(
    terminalIdx !== -1 ? Math.min(terminalIdx, anchorIdx + 2) : anchorIdx + 2,
    stations.length - 1,
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
          const isView = stationName === viewStation
          const isTrain = stationName === currentStation && trainApproaching
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
                <div
                  className="rounded-full flex-shrink-0 border-2 border-white dark:border-surface-dark"
                  style={{
                    width: isView ? 14 : isTrain ? 12 : 9,
                    height: isView ? 14 : isTrain ? 12 : 9,
                    background: isView
                      ? color
                      : isTrain
                        ? '#f59e0b'
                        : isPast
                          ? (darkMode ? '#334155' : '#e2e8f0')
                          : (darkMode ? '#475569' : '#cbd5e1'),
                    outline: isView ? `2px solid ${color}` : isTrain ? '2px solid #f59e0b' : 'none',
                    outlineOffset: 1,
                    opacity: isPast ? 0.35 : 1,
                  }}
                />
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
                    여기
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
