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

  return (
    <>
      {/* 백드롭 */}
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

      {/* 시트 */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-[#272a33] rounded-t-[18px] flex flex-col overflow-hidden"
        style={{
          height: '70vh',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform 0.3s ${EASE}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>

        {/* 헤더 */}
        <div
          className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0"
          style={{ background: lineColor }}
        >
          <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0" />
          <span className="flex-1 text-[15px] font-bold text-white truncate">
            {displayed ? `${displayed.line} · ${displayed.destination} 방면` : ''}
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
