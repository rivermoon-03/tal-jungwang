import useAppStore from '../../stores/useAppStore'

// arvlCd 0,1,5 → 임박 (빨간색)
function isImminent(statusCode) {
  return [0, 1, 5].includes(statusCode)
}

// "[4]번째 전역" → "4번째 전역" / "[역명] 진입" → "역명 진입"
function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

// arvlCd에 따른 한국어 상태 레이블
function statusLabel(code) {
  switch (code) {
    case 0: return '진입 중'
    case 1: return '도착'
    case 2: return '출발'
    case 3: return '전역 출발'
    case 4: return '전역 진입'
    case 5: return '전역 도착'
    default: return '운행 중'
  }
}

// 하단 보조 텍스트: 상태 + 위치 정보 조합
function formatSubtext(item) {
  const { status_code, status_msg, location_msg } = item

  if (isImminent(status_code)) {
    // 임박: arvlMsg2 우선 (간결한 상태), 없으면 코드 기반 레이블
    const base = cleanMsg(status_msg) || statusLabel(status_code)
    // location_msg가 추가 맥락 있으면 병기 ("전역 도착 · 구로디지털단지역 도착")
    if (location_msg && location_msg !== status_msg) {
      return `${base} · ${cleanMsg(location_msg)}`
    }
    return base
  }

  // 운행 중: arvlMsg3(위치/시간 메시지) 우선 → arvlMsg2 → 기본
  const loc = cleanMsg(location_msg)
  const msg = cleanMsg(status_msg)
  if (loc) return msg && msg !== loc ? `${msg} · ${loc}` : loc
  return msg || '운행 중'
}

function ArrivalTime({ item }) {
  const imminent = isImminent(item.status_code)
  const color = imminent ? '#dc2626' : item.color
  const secs = item.arrive_seconds

  let label, sub
  if (imminent) {
    label = '곧'
    sub = '도착'
  } else if (secs != null && secs >= 0) {
    const mins = Math.ceil(secs / 60)
    label = mins <= 0 ? '곧' : `${mins}`
    sub = mins <= 0 ? '도착' : '분 후'
  } else {
    label = '—'
    sub = '운행중'
  }

  return (
    <div className="flex flex-col items-end justify-center w-16 flex-shrink-0 border-l border-slate-100 dark:border-slate-800 pl-3">
      <span
        className="text-2xl font-black leading-none tabular-nums tracking-tight"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>
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
      {/* 좌: 노선 dot + 목적지 + 위치 */}
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
          {/* 목적지 + 막차 배지 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-xl font-extrabold leading-tight tracking-tight ${destColor}`}>
              {item.destination}
              <span className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-1">행</span>
            </span>
            {item.is_last_train && (
              <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
                막차
              </span>
            )}
            {item.train_type && item.train_type !== '일반' && (
              <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none flex-shrink-0"
                style={{ background: item.color }}>
                {item.train_type}
              </span>
            )}
          </div>
          {/* 상태 + 위치 메시지 */}
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
            {formatSubtext(item)}
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
  const seohae = arrivals.filter((a) => a.line === '서해선')

  return (
    <div className="flex-1 overflow-y-auto">
      <Section lineName="4호선" color="#1B5FAD" items={line4} onRowClick={onRowClick} />
      <Section lineName="수인분당선" color="#F5A623" items={suinbundang} onRowClick={onRowClick} />
      <Section lineName="서해선" color="#75bf43" items={seohae} onRowClick={onRowClick} />
    </div>
  )
}
