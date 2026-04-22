import useAppStore from '../../stores/useAppStore'

// 방향별 역 목록 (열차 진행 방향 순서)
const STATION_SEQUENCES = {
  '4호선': {
    상행: ['오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '상록수', '반월', '대야미', '수리산', '산본', '금정'],
    하행: ['금정', '산본', '수리산', '대야미', '반월', '상록수', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도'],
  },
  '수인분당선': {
    상행: ['오이도', '정왕', '신길온천', '안산', '초지', '고잔', '중앙', '한대앞', '사리', '야목', '어천', '오목천', '고색', '수원'],
    하행: ['수원', '고색', '오목천', '어천', '야목', '사리', '한대앞', '중앙', '고잔', '초지', '안산', '신길온천', '정왕', '오이도', '달월', '월곶', '소래포구'],
  },
}

const JEONGWANG = '정왕'

export default function SubwayLineMap({ line, direction, currentStation, terminalStation, color }) {
  const darkMode = useAppStore((s) => s.darkMode)
  const stations = STATION_SEQUENCES[line]?.[direction] ?? []

  if (stations.length === 0) return null

  const jeongwangIdx = stations.indexOf(JEONGWANG)
  const currentIdx = stations.indexOf(currentStation)
  const trainApproaching = currentIdx !== -1 && currentIdx < jeongwangIdx

  // 표시할 역 범위: 현재역 또는 정왕 기준 앞 1개 ~ 종착역(또는 정왕 뒤 6개) 중 가까운 쪽
  const terminalIdx = terminalStation ? stations.indexOf(terminalStation) : -1
  const startIdx = Math.max(0, Math.min(currentIdx !== -1 ? currentIdx : jeongwangIdx, jeongwangIdx) - 1)
  const endIdx = Math.min(
    stations.length - 1,
    terminalIdx !== -1 ? terminalIdx : jeongwangIdx + 6,
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
          const isJeongwang = stationName === JEONGWANG
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
                    width: isJeongwang ? 14 : isTrain ? 12 : 9,
                    height: isJeongwang ? 14 : isTrain ? 12 : 9,
                    background: isJeongwang
                      ? color
                      : isTrain
                        ? '#f59e0b'
                        : isPast
                          ? (darkMode ? '#334155' : '#e2e8f0')
                          : (darkMode ? '#475569' : '#cbd5e1'),
                    outline: isJeongwang ? `2px solid ${color}` : isTrain ? '2px solid #f59e0b' : 'none',
                    outlineOffset: 1,
                    opacity: isPast ? 0.35 : 1,
                  }}
                />
                {/* 아래 선 */}
                {i < visible.length - 1 && (
                  <div
                    className="w-0.5 h-3"
                    style={{
                      background: isJeongwang || absoluteIdx >= jeongwangIdx
                        ? (darkMode ? '#334155' : '#e2e8f0')
                        : color,
                      opacity: isPast ? 0.4 : 1,
                    }}
                  />
                )}
              </div>

              {/* 역명 + 뱃지 */}
              <div className={`flex items-center gap-2 ml-3 py-0.5`}>
                <span
                  className={`leading-none ${
                    isJeongwang
                      ? 'text-sm font-extrabold'
                      : isTrain
                        ? 'text-sm font-bold'
                        : 'text-xs'
                  } ${
                    isJeongwang
                      ? 'text-slate-900 dark:text-slate-100'
                      : isTrain
                        ? 'text-amber-600 dark:text-amber-400'
                        : isPast
                          ? 'text-slate-300 dark:text-slate-700'
                          : 'text-slate-500 dark:text-slate-400'
                  }`}
                  style={isJeongwang ? { color } : {}}
                >
                  {stationName}
                </span>
                {isJeongwang && (
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
