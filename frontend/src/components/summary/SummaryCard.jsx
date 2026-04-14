import { Bus, TramFront, TrainFront, ChevronUp, ChevronDown } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import SubwayPanel from './SubwayPanel'
import BusPanel from './BusPanel'
import ShuttlePanel from './ShuttlePanel'

const MODE_TABS = [
  { id: 'subway',  label: '지하철', Icon: TrainFront },
  { id: 'bus',     label: '버스',   Icon: Bus },
  { id: 'shuttle', label: '셔틀',   Icon: TramFront },
]

/**
 * SummaryCard — 교통수단 요약 카드
 *
 * 펼침: 헤더 + mode pill tabs + 선택된 모드 패널
 * 접힘: floating pill "{모드 아이콘} {노선} {N분}" + ⌄
 *
 * Props:
 *   onNextArrivalChange — (nextArrival) => void  부모(HeroTitleBar)로 다음 도착 정보 전달
 */
export default function SummaryCard({ onNextArrivalChange }) {
  const cardCollapsed  = useAppStore((s) => s.cardCollapsed)
  const toggleCard     = useAppStore((s) => s.toggleCard)
  const selectedMode   = useAppStore((s) => s.selectedMode)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)

  const ActiveIcon = MODE_TABS.find((t) => t.id === selectedMode)?.Icon ?? Bus
  const modeLabel  = MODE_TABS.find((t) => t.id === selectedMode)?.label ?? '버스'

  // ── 접힘 pill ──────────────────────────────────────────────────────
  if (cardCollapsed) {
    return (
      <div className="px-3 pb-2 flex justify-center">
        <button
          onClick={toggleCard}
          aria-label="교통수단 카드 펼치기"
          aria-expanded={false}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark
                     rounded-pill shadow-pill text-sm font-semibold text-gray-800 dark:text-gray-100
                     active:scale-95 transition-transform"
          style={{ transition: 'transform 0.1s var(--ease-spring)' }}
        >
          <ActiveIcon size={15} aria-hidden="true" />
          <span>{modeLabel}</span>
          <ChevronDown size={15} className="text-gray-400" aria-hidden="true" />
        </button>
      </div>
    )
  }

  // ── 펼침 ──────────────────────────────────────────────────────────
  return (
    <div className="mx-3 mb-3 bg-white dark:bg-surface-dark rounded-card shadow-card overflow-hidden">
      {/* 카드 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={toggleCard}
        role="button"
        aria-expanded={true}
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleCard()}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">교통수단</span>
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <ActiveIcon size={12} aria-hidden="true" />
            {modeLabel}
          </span>
        </div>
        <ChevronUp size={18} className="text-gray-400" aria-hidden="true" />
      </div>

      {/* Mode pill tabs */}
      <div className="flex gap-2 px-4 pb-3">
        {MODE_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setSelectedMode(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-pill transition-colors
              ${selectedMode === id
                ? 'bg-coral text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
          >
            <Icon size={12} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* 선택된 모드 패널 */}
      <div className="px-4 pb-4">
        {selectedMode === 'subway' && <SubwayPanel />}
        {selectedMode === 'bus'    && <BusPanel />}
        {selectedMode === 'shuttle' && <ShuttlePanel />}
      </div>
    </div>
  )
}
