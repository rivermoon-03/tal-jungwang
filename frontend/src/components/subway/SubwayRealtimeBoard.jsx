import useAppStore from '../../stores/useAppStore'

// arvlCd 0,1,5 → 임박 (빨간색)
function isImminent(statusCode) {
  return [0, 1, 5].includes(statusCode)
}

function formatStatusMsg(item) {
  const { status_code, status_msg, current_station } = item
  if (status_code === 0) return `${current_station} 진입 중`
  if (status_code === 1) return `${current_station} 도착`
  if (status_code === 5) return `전역 도착 (${current_station})`
  return status_msg
}

function ArrivalTime({ item }) {
  const imminent = isImminent(item.status_code)
  const color = imminent ? '#dc2626' : item.color

  return (
    <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
      <span
        className="text-2xl font-black leading-none tabular-nums tracking-tight"
        style={{ color }}
      >
        {imminent ? '곧' : '?'}
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">
        {imminent ? '도착' : '운행중'}
      </span>
    </div>
  )
}

function RealtimeRow({ item, onClick }) {
  const imminent = isImminent(item.status_code)
  const darkMode = useAppStore((s) => s.darkMode)

  const rowBg = imminent
    ? (darkMode ? 'bg-red-950/30' : 'bg-red-50')
    : 'bg-white dark:bg-surface-dark'

  const destColor = imminent ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors ${rowBg}`}
      onClick={() => onClick?.(item)}
    >
      {/* 좌: 노선 dot + 목적지 + 현재위치 */}
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: item.color }}
          />
          <span className="text-[9px] text-slate-400 font-medium leading-none whitespace-nowrap">
            {item.direction}
          </span>
        </div>
        <div className="min-w-0">
          {/* 목적지 — 가장 크고 굵게 */}
          <div className={`text-xl font-extrabold leading-tight tracking-tight ${destColor}`}>
            {item.destination}
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-1">행</span>
          </div>
          {/* 현재위치 — 작게 */}
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {formatStatusMsg(item)}
          </div>
        </div>
      </div>

      {/* 우: 도착 시간 */}
      <ArrivalTime item={item} />
    </div>
  )
}

function Section({ lineName, color, items, onRowClick }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{lineName}</span>
      </div>
      {items.map((item) => (
        <RealtimeRow key={item.train_no} item={item} onClick={onRowClick} />
      ))}
    </div>
  )
}

export default function SubwayRealtimeBoard({ arrivals, onRowClick }) {
  if (!arrivals || arrivals.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
        현재 운행 중인 열차 정보가 없습니다
      </div>
    )
  }

  const line4 = arrivals.filter((a) => a.line === '4호선')
  const suinbundang = arrivals.filter((a) => a.line === '수인분당선')

  return (
    <div className="flex-1 overflow-y-auto">
      <Section lineName="4호선" color="#1B5FAD" items={line4} onRowClick={onRowClick} />
      <Section lineName="수인분당선" color="#F5A623" items={suinbundang} onRowClick={onRowClick} />
    </div>
  )
}
