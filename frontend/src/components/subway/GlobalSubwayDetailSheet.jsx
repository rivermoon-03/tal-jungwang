import { useEffect, useRef, useState } from 'react'
import { X, TrainFront, RefreshCw, Map, ChevronLeft } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayTimetable, useSubwayRealtime } from '../../hooks/useSubway'
import { useSecondsCountdown } from '../../hooks/useSecondsCountdown'
import { getSpecialTrainIndices } from '../../utils/trainTime'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

// ordkey 또는 status_msg에서 남은 정거장 수 추출
function getStationCount(train) {
  if (!train) return null
  const { ordkey, status_msg } = train

  if (ordkey && ordkey.length >= 5) {
    const countStr = ordkey.substring(2, 5)
    const count = parseInt(countStr, 10)
    if (!isNaN(count) && count > 0) return count
  }

  if (status_msg) {
    const match = status_msg.match(/\[?(\d+)\]?번째/)
    if (match) return parseInt(match[1], 10)
  }

  return null
}

function cleanMsg(msg) {
  if (!msg) return ''
  return msg.replace(/\[(\d+)\]/g, '$1').replace(/\[([^\]]+)\]/g, '$1')
}

export default function GlobalSubwayDetailSheet() {
  const item = useAppStore((s) => s.subwayDetailSheet)
  const close = useAppStore((s) => s.closeSubwayDetailSheet)
  const setSubwayLineSheet = useAppStore((s) => s.setSubwayLineSheet)
  
  const { data: timetable, loading: ttLoading } = useSubwayTimetable()
  const { data: realtimeAll, loading: realtimeLoading, refetch } = useSubwayRealtime()
  
  const [visible, setVisible] = useState(false)
  const [refreshCooldown, setRefreshCooldown] = useState(0)
  const prevItem = useRef(null)

  useEffect(() => {
    if (item) {
      prevItem.current = item
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [item])

  const handleManualRefresh = async () => {
    if (refreshCooldown > 0) return
    await refetch()
    setRefreshCooldown(10)
  }

  useEffect(() => {
    if (refreshCooldown <= 0) return
    const id = setInterval(() => setRefreshCooldown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [refreshCooldown])

  const displayed = item ?? prevItem.current
  if (!displayed && !visible) return null

  // 현재 노선/방향에 해당하는 실시간 열차들
  const stationArrivals = realtimeAll?.[displayed.station] ?? []
  const directionArrivals = stationArrivals.filter(
    (a) => a.line === displayed.lineName && a.direction === displayed.direction
  )

  // 상단에 강조해서 보여줄 열차 (직접 전달받았거나, 목록 전체)
  const realtimeTrains = displayed.realtimeTrain ? [displayed.realtimeTrain] : directionArrivals

  // 시간표 데이터
  const trains = timetable?.[displayed.timetableKey] ?? []
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  function handleClose() {
    setVisible(false)
    setTimeout(close, 320)
  }

  // 실시간 상태 카드 렌더링
  const renderRealtimeStatus = () => {
    if (!realtimeTrains || realtimeTrains.length === 0) return null

    return (
      <div className="flex flex-col gap-2 mx-4 mt-3">
        {realtimeTrains.map((rtTrain, idx) => {
          const secs = rtTrain.arrive_seconds
          const isImminent = [0, 1, 3, 4, 5].includes(rtTrain.status_code)
          let etaLabel
          if (rtTrain.status_code === 1 || rtTrain.status_code === 2) {
            etaLabel = '이미 도착'
          } else if (rtTrain.status_code === 0) {
            etaLabel = '진입 중'
          } else if (typeof secs === 'number' && secs > 0) {
            const mins = Math.ceil(secs / 60)
            etaLabel = mins <= 0 ? '이미 도착' : `${mins}분 후`
          } else if ([3, 4, 5].includes(rtTrain.status_code)) {
            if (displayed.lineName === '4호선' && displayed.direction === '상행' && rtTrain.status_code === 5 && (rtTrain.location_msg?.includes('오이도') || rtTrain.current_station === '오이도')) {
              etaLabel = '오이도'
            } else {
              etaLabel = '곧 도착'
            }
          } else {
            const count = getStationCount(rtTrain)
            if (count != null && count > 0) {
              etaLabel = `${count}역 전`
            } else {
              const msg = cleanMsg(rtTrain.smart_status) || cleanMsg(rtTrain.location_msg) || cleanMsg(rtTrain.status_msg)
              etaLabel = msg ? (msg.endsWith('중') || msg.endsWith('도착') || msg.endsWith('출발') ? msg : `${msg} 인근`) : '운행 중'
            }
          }

          return (
            <div key={rtTrain.train_no || idx} className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
              {idx === 0 && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">이 열차 실시간</p>}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {rtTrain.destination}행
                  </span>
                  {rtTrain.is_last_train && (
                    <span className="ml-1.5 text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">막차</span>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {cleanMsg(rtTrain.status_msg) || ''}{rtTrain.location_msg ? ` · ${cleanMsg(rtTrain.location_msg)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg font-black"
                    style={{ color: isImminent ? '#dc2626' : displayed.color }}
                  >
                    {etaLabel}
                  </span>
                  <button
                    onClick={() => setSubwayLineSheet({ ...rtTrain, viewStation: displayed.station })}
                    className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Map size={12} />
                    노선도
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[90]"
        style={{
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.3s ${EASE}`,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={handleClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-[#272a33] rounded-t-[18px] flex flex-col overflow-hidden"
        style={{
          height: '82vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform 0.3s ${EASE}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>

        {/* 통합 헤더 */}
        <div className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0" style={{ background: displayed.color }}>
          <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-bold text-white truncate">
              {displayed.lineName} · {displayed.direction}
            </h2>
          </div>
          
          <button
            onClick={handleManualRefresh}
            disabled={refreshCooldown > 0 || realtimeLoading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              refreshCooldown > 0 ? 'bg-black/10 text-white/40' : 'bg-black/20 text-white hover:bg-black/30'
            }`}
          >
            <RefreshCw size={12} className={realtimeLoading ? 'animate-spin' : ''} />
            <span>{refreshCooldown > 0 ? `${refreshCooldown}s` : '업데이트'}</span>
          </button>

          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {/* 실시간 열차 상태 (가장 가까운 열차 자동 선택) */}
          {renderRealtimeStatus()}

          {/* 카운트다운 */}
          {!ttLoading && (
            <SubwayCountdown nextTrain={nextTrain} lineColor={displayed.color} lineDarkColor={displayed.darkColor} />
          )}

          {/* 전체 시간표 */}
          {!ttLoading && trains.length > 0 ? (
            <SubwayTimetable
              entries={trains}
              nextIndex={nextIndex}
              lastIdx={lastIdx ?? null}
              firstIdx={firstIdx ?? null}
              lineColor={displayed.color}
              lineDarkColor={displayed.darkColor}
              lineLightColor={displayed.lightColor}
            />
          ) : !ttLoading && (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">시간표 데이터가 없습니다</div>
          )}
        </div>
      </div>
    </>
  )
}
 
