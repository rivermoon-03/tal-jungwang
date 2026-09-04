import { useEffect, useState } from 'react'
import { X, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import SubwayLineMap from './SubwayLineMap'
import { PC_SIDEBAR_WIDTH_PX } from '../layout/PCMainShell'

// PC는 좌측 패널(MarkerSheet/GlobalSubwayDetailSheet)과 같은 영역 안에서
// 콘텐츠가 교체되듯 보여야 하므로(오프스크린 슬라이드가 아니고 백드롭도 없는
// 도킹 패널) ui/Sheet의 bottom/center 두 배치로는 표현할 수 없다 — 그래서 PC
// 분기는 기존 opacity+8px 크로스페이드를 그대로 유지한다. 모바일만 Sheet로
// 옮긴다(백드롭·Escape·포커스 트랩·z 토큰을 Sheet에 맡긴다 — vaul이 하던 스와이프
// 닫기는 없어지고, 다른 시트들과 동일하게 배경 탭/Escape로 닫는다. 아홉 벌
// 독립 구현을 하나로 맞추는 게 이번 리팩터의 목적이라 트레이드오프로 받는다).
const EASE = 'var(--e-out)'

// GlobalSubwayDetailSheet(z-sheet, 시간표 상세) 안에서 노선도를 열면 그 위로
// 떠야 한다. z 스케일에 "시트 위의 시트" 전용 토큰이 없어 다음으로 큰 토큰인
// z-popover를 재사용한다(모바일 Sheet의 className과 PC 고정 패널 양쪽 모두).
const STACKED_ABOVE_DETAIL_SHEET = 'z-popover'

export default function GlobalSubwayLineSheet() {
  const item = useAppStore((s) => s.subwayLineSheet)
  const close = useAppStore((s) => s.closeSubwayLineSheet)
  const isDesktop = useIsDesktop()
  // 닫힘 애니메이션 동안 콘텐츠를 유지하려는 스냅샷이다. ref로 두면 렌더 중
  // 읽게 되어 동시성 렌더에서 값이 어긋날 수 있으므로 state로 보관한다.
  const [prevItem, setPrevItem] = useState(null)

  // PC 크로스페이드용 visible 상태(기존 로직 유지) — 모바일은 Sheet가
  // 마운트/언마운트를 즉시 처리하므로 이 상태와 무관하다.
  const [pcVisible, setPcVisible] = useState(false)

  // 스냅샷 갱신은 렌더 중 조정으로, 크로스페이드 토글만 effect에 남긴다.
  const [seenItem, setSeenItem] = useState(null)
  if (item && item !== seenItem) {
    setSeenItem(item)
    setPrevItem(item)
  }
  // 닫힐 때는 렌더 중에 즉시 끄고, 열릴 때의 페이드 인만 다음 프레임으로 미룬다.
  if (!item && pcVisible) setPcVisible(false)
  useEffect(() => {
    if (!item) return undefined
    const id = requestAnimationFrame(() => setPcVisible(true))
    return () => cancelAnimationFrame(id)
  }, [item])

  const displayed = item ?? prevItem
  const open = !!item

  // PC는 백드롭, 포커스 트랩이 없는 도킹 패널(Sheet 미적용)이라 자체 Escape
  // 핸들러가 필요하다(모바일은 Sheet가 Escape를 자동 처리, GlobalSubwayDetailSheet와
  // 동일한 이유다). 예전엔 이 핸들러 자체가 없어 PC에서 노선도 시트를 키보드로
  // 닫을 방법이 없었다.
  useEffect(() => {
    if (!isDesktop || !open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDesktop, open, close])

  if (!displayed && !open) return null

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
      <span className="flex-1 text-list-nm font-bold text-white truncate">
        {headerLabel}
      </span>
      <IconButton
        label="닫기"
        onClick={close}
        className="text-white/70 hover:text-white hover:bg-white/10"
      >
        <X size={18} />
      </IconButton>
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

  if (isDesktop) {
    return (
      <div
        role="region"
        aria-label={headerLabel || '지하철 노선도'}
        className={`fixed top-0 bottom-0 ${STACKED_ABOVE_DETAIL_SHEET} bg-surface dark:bg-surface flex flex-col overflow-hidden`}
        style={{
          // GlobalSubwayDetailSheet와 같은 이유, 같은 계산이다(그쪽 주석 참고).
          // 사이드바 뒤가 아니라 사이드바 오른쪽 칼럼에서 시작하고, 오른쪽 끝은
          // 예전 38% 폭 그대로 유지한다.
          left: PC_SIDEBAR_WIDTH_PX,
          width: `calc(38% - ${PC_SIDEBAR_WIDTH_PX}px)`,
          opacity: pcVisible ? 1 : 0,
          transform: pcVisible ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity var(--dur-motion-base) ${EASE}, transform var(--dur-motion-base) ${EASE}`,
          pointerEvents: pcVisible ? 'auto' : 'none',
        }}
      >
        {header}
        {lineMap}
      </div>
    )
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      label={headerLabel || '지하철 노선도'}
      placement="bottom"
      className={`h-[70vh] ${STACKED_ABOVE_DETAIL_SHEET}`}
    >
      {header}
      {lineMap}
    </Sheet>
  )
}
