import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'vaul'
import { X, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import SubwayLineMap from './SubwayLineMap'

// PC는 좌측 패널(MarkerSheet/GlobalSubwayDetailSheet)과 같은 영역 안에서
// 콘텐츠가 교체되듯 보여야 하므로(오프스크린 슬라이드가 아님) vaul을 쓰지 않고
// 기존 opacity+8px 크로스페이드를 그대로 유지한다.
// 모바일은 바텀시트 → vaul(Drawer)로 스와이프 다운 닫기를 지원한다(Phase C).
const EASE = 'var(--e-out)'

export default function GlobalSubwayLineSheet() {
  const item = useAppStore((s) => s.subwayLineSheet)
  const close = useAppStore((s) => s.closeSubwayLineSheet)
  const prevItem = useRef(null)

  // PC 크로스페이드용 visible 상태(기존 로직 유지)
  const [pcVisible, setPcVisible] = useState(false)

  useEffect(() => {
    if (item) {
      prevItem.current = item
      requestAnimationFrame(() => setPcVisible(true))
    } else {
      setPcVisible(false)
    }
  }, [item])

  const displayed = item ?? prevItem.current
  const open = !!item

  if (!displayed && !open) return null

  const isPC =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

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

  const header = (
    <div
      className="flex items-center gap-2.5 px-5 py-3 flex-shrink-0"
      style={{ background: lineColor }}
    >
      <TrainFront size={18} strokeWidth={2} className="text-white flex-shrink-0" />
      <span className="flex-1 text-[15px] font-bold text-white truncate">
        {headerLabel}
      </span>
      <button
        onClick={close}
        aria-label="닫기"
        className="pressable w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
      >
        <X size={18} />
      </button>
    </div>
  )

  const lineMap = (
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
  )

  if (isPC) {
    return (
      <div
        className="fixed left-0 right-auto w-[38%] h-auto bottom-[68px] top-0 z-[120] bg-surface dark:bg-surface flex flex-col overflow-hidden"
        style={{
          opacity: pcVisible ? 1 : 0,
          transform: pcVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity var(--dur-motion-base) ${EASE}, transform var(--dur-motion-base) ${EASE}`,
          pointerEvents: pcVisible ? 'auto' : 'none',
        }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-11 h-1 rounded-full bg-line-strong dark:bg-line-strong" />
        </div>
        {header}
        {lineMap}
      </div>
    )
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) close() }}
      dismissible
    >
      <Drawer.Portal>
        {/* DetailSheet(시간표, z-[100]) 위에 올라와야 하므로 z-[110] */}
        <Drawer.Overlay
          className="fixed inset-0 z-[110] bg-black/40"
          style={{ transition: `opacity var(--dur-motion-sheet) ${EASE}` }}
        />
        {/* GlobalSubwayDetailSheet(z-[100]) 위로 올라와야 하므로 z-[120] */}
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 h-[70vh] z-[120] bg-surface dark:bg-surface rounded-t-sheet flex flex-col overflow-hidden outline-none"
          style={{ boxShadow: '0 -4px 24px rgba(0,0,0,0.15)' }}
        >
          <Drawer.Title className="sr-only">{headerLabel || '지하철 노선도'}</Drawer.Title>
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-11 h-1 rounded-full bg-line-strong dark:bg-line-strong" />
          </div>
          {header}
          {lineMap}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
