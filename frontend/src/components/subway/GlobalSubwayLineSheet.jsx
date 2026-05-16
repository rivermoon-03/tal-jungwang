import { useEffect, useRef, useState } from 'react'
import { X, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import SubwayLineMap from './SubwayLineMap'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default function GlobalSubwayLineSheet() {
  const item = useAppStore((s) => s.subwayLineSheet)
  const close = useAppStore((s) => s.closeSubwayLineSheet)
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

  // item이 null이 되면 닫기 애니메이션 뒤에 언마운트
  const displayed = item ?? prevItem.current
  if (!displayed && !visible) return null

  function handleClose() {
    setVisible(false)
    setTimeout(close, 320)
  }

  const lineColor = displayed?.color ?? '#1B5FAD'

  // trains 배열을 우선 사용. 없으면 legacy 단일 train 필드에서 합성.
  const trainsList = Array.isArray(displayed?.trains) && displayed.trains.length > 0
    ? displayed.trains
    : (displayed?.current_station
        ? [{
            current_station: displayed.current_station,
            destination: displayed.destination,
            train_no: displayed.train_no,
          }]
        : [])
  const uniqueDests = Array.from(new Set(trainsList.map((t) => t.destination).filter(Boolean)))
  const headerLabel = displayed
    ? (uniqueDests.length <= 1
        ? `${displayed.line} · ${uniqueDests[0] ?? displayed.destination ?? ''} 방면`
        : `${displayed.line} · ${displayed.direction}`)
    : ''

  return (
    <>
      {/* 백드롭 (모바일만) — DetailSheet(시간표) 위에 올라와야 하므로 z-[110] */}
      <div
        className="fixed inset-0 z-[110] md:hidden"
        style={{
          background: 'rgba(0,0,0,0.4)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.3s ${EASE}`,
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* 시트 — 모바일: 하단 70vh. PC: 좌측 38%, 하단 dock 위.
          GlobalSubwayDetailSheet(z-[100]) 위로 슬라이드 인 되어야 하므로 z-[120] */}
      <div
        className="fixed bottom-0 left-0 right-0 h-[70vh] md:right-auto md:w-[38%] md:h-auto md:bottom-[56px] md:top-0 z-[120] bg-surface dark:bg-surface-dark rounded-t-[18px] md:rounded-t-none md:rounded-r-card-pc md:border-r md:border-line dark:md:border-line-dark flex flex-col overflow-hidden"
        style={{
          transform: visible
            ? 'translate(0, 0)'
            : (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
              ? 'translateX(-100%)'
              : 'translateY(100%)'),
          transition: `transform 0.3s ${EASE}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-11 h-1 rounded-full bg-mute-2 dark:bg-mute-2-dark" />
        </div>

        {/* 헤더 */}
        <div
          className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0"
          style={{ background: lineColor }}
        >
          <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0" />
          <span className="flex-1 text-[15px] font-bold text-white truncate">
            {headerLabel}
          </span>
          <button
            onClick={handleClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* 노선도 */}
        <div className="flex-1 overflow-y-auto">
          {displayed && (
            <SubwayLineMap
              line={displayed.line}
              direction={displayed.direction}
              trains={trainsList}
              currentStation={displayed.current_station}
              terminalStation={displayed.destination}
              color={lineColor}
              viewStation={displayed.viewStation ?? displayed.current_station}
            />
          )}
        </div>
      </div>
    </>
  )
}
