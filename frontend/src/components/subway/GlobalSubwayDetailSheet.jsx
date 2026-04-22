import { useEffect, useRef, useState } from 'react'
import { X, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { useSubwayTimetable, useSubwayRealtime } from '../../hooks/useSubway'
import { getSpecialTrainIndices } from '../../utils/trainTime'
import SubwayCountdown from './SubwayCountdown'
import SubwayTimetable from './SubwayTimetable'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

function timeToMinutes(t) {
  const [hh, mm] = t.split(':').map(Number)
  return hh * 60 + mm
}

function cleanMsg(msg) {
  if (!msg) return ''
  // "[4]번째 전역" → "4번째 전역"
  return msg.replace(/\[(\d+)\]/g, '$1')
}

function RealtimeRow({ train, color }) {
  const secs = train.arrive_seconds
  const isImminent = [0, 1, 5].includes(train.status_code)

  let timeLabel
  if (isImminent) {
    timeLabel = '곧 도착'
  } else if (secs != null && secs >= 0) {
    const mins = Math.ceil(secs / 60)
    timeLabel = mins <= 0 ? '곧 도착' : `${mins}분 후`
  } else {
    timeLabel = cleanMsg(train.location_msg) || cleanMsg(train.status_msg) || '운행 중'
  }

  const statusDesc = cleanMsg(train.status_msg) || ''

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {train.destination}행
          </span>
          {train.is_last_train && (
            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full leading-none">막차</span>
          )}
          {train.train_type && train.train_type !== '일반' && train.train_type !== '' && (
            <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none"
              style={{ background: color }}>{train.train_type}</span>
          )}
        </div>
        {statusDesc && (
          <p className="text-xs text-slate-400 mt-0.5">{statusDesc}</p>
        )}
      </div>
      <span
        className="text-sm font-black ml-3 flex-shrink-0"
        style={{ color: isImminent ? '#dc2626' : color }}
      >
        {timeLabel}
      </span>
    </div>
  )
}

function SheetContent({ displayed, onClose }) {
  const { data: timetable, loading: ttLoading } = useSubwayTimetable()
  const { data: realtimeAll } = useSubwayRealtime()

  const trains = timetable?.[displayed.timetableKey] ?? []
  const stationArrivals = realtimeAll?.[displayed.station] ?? []
  const directionArrivals = stationArrivals.filter(
    (a) => a.line === displayed.lineName && a.direction === displayed.direction
  )

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const nextIndex = trains.findIndex((t) => timeToMinutes(t.depart_at) > nowMin)
  const nextTrain = nextIndex >= 0 ? trains[nextIndex] : null
  const { lastIdx, firstIdx } = getSpecialTrainIndices(trains)

  return (
    <>
      {/* 핸들 */}
      <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
        <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
      </div>

      {/* 헤더 */}
      <div
        className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0"
        style={{ background: displayed.color }}
      >
        <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0" />
        <span className="flex-1 text-[15px] font-bold text-white truncate">
          {displayed.lineName} · {displayed.direction}
        </span>
        <button
          onClick={onClose}
          aria-label="닫기"
          className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto pb-8">
        {/* 실시간 도착 열차 */}
        {directionArrivals.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">실시간 도착</p>
            {directionArrivals.map((t) => (
              <RealtimeRow key={t.train_no} train={t} color={displayed.color} />
            ))}
            <div className="mt-2 border-t border-slate-100 dark:border-slate-800" />
          </div>
        )}

        {/* 시간표 카운트다운 */}
        {!ttLoading && (
          <SubwayCountdown
            nextTrain={nextTrain}
            lineColor={displayed.color}
            lineDarkColor={displayed.darkColor}
          />
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
        ) : !ttLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            시간표 데이터가 없습니다
          </div>
        ) : (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
            불러오는 중...
          </div>
        )}
      </div>
    </>
  )
}

export default function GlobalSubwayDetailSheet() {
  const item = useAppStore((s) => s.subwayDetailSheet)
  const close = useAppStore((s) => s.closeSubwayDetailSheet)
  const [visible, setVisible] = useState(false)
  const prevItem = useRef(null)

  useEffect(() => {
    if (item) {
      prevItem.current = item
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [item])

  useEffect(() => {
    if (!item) return
    const handler = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [item, close])

  const displayed = item ?? prevItem.current
  if (!displayed && !visible) return null

  function handleClose() {
    setVisible(false)
    setTimeout(close, 320)
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
        aria-hidden="true"
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
        {displayed && <SheetContent displayed={displayed} onClose={handleClose} />}
      </div>
    </>
  )
}
