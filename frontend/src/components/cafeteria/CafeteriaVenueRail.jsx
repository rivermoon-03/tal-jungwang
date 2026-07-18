/**
 * CafeteriaVenueRail.jsx — PC 학식 화면 좌측 rail
 *
 * data.cafeterias 목록을 카드로 나열한다. 각 카드는 운영상태 pill(전부
 * getCafeteriaStatus 결과)과 위치·시간 서브텍스트를 보여주고, 클릭하면
 * onSelect(idx)로 우측 상세 패널을 전환한다. 정적 venue로 매핑된 카드에는
 * 상세 페이지(/cafeteria/:venueId)로 진입하는 보조 버튼을 추가로 둔다.
 */
import { ChevronRight } from 'lucide-react'
import { resolveVenueForCafeteria, getCafeteriaStatus } from '../../utils/cafeteriaMenuVenue'

// isOpenNow가 open:true로 판정하는 status 값 — pill을 "운영 중"(초록)으로 묶는다.
const OPEN_STATUSES = new Set(['open', 'closing', 'always'])

function navigateToVenue(venueId) {
  window.history.pushState(null, '', `/cafeteria/${encodeURIComponent(venueId)}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function StatusPill({ status, primaryLabel }) {
  if (status === 'unknown') return null
  const isOpen = OPEN_STATUSES.has(status)
  return (
    <span
      className={[
        'inline-flex items-center justify-center flex-shrink-0',
        'px-2 py-0.5 rounded-pill text-caption font-semibold whitespace-nowrap',
        isOpen ? 'bg-chip-green-bg text-chip-green-fg' : 'bg-chip-red-bg text-chip-red-fg',
      ].join(' ')}
    >
      {isOpen ? '운영 중' : (primaryLabel || '운영 종료')}
    </span>
  )
}

function VenueCard({ cafeteria, isSelected, onSelect, nowDate }) {
  const status = getCafeteriaStatus(cafeteria.name, nowDate)
  const venue = resolveVenueForCafeteria(cafeteria.name)
  const subText = [status.location, status.timeLabel].filter(Boolean).join(' · ')

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={[
        'flex items-center gap-2 rounded-card border px-3 py-3 cursor-pointer select-none',
        'transition-colors duration-press',
        isSelected
          ? 'border-accent bg-accent-bg'
          : 'border-line bg-surface hover:bg-surface-2',
      ].join(' ')}
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-body font-bold text-ink truncate">{cafeteria.name}</span>
          <StatusPill status={status.status} primaryLabel={status.primaryLabel} />
        </div>
        {subText && (
          <p className="mt-1 text-caption text-mute truncate">{subText}</p>
        )}
      </div>

      {venue && (
        <button
          type="button"
          aria-label={`${cafeteria.name} 상세 보기`}
          onClick={(e) => {
            e.stopPropagation()
            navigateToVenue(venue.id)
          }}
          className="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-full text-mute hover:text-ink hover:bg-surface-2"
          style={{ touchAction: 'manipulation' }}
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}

/**
 * @param {object[]} cafeterias — data.cafeterias
 * @param {string|null} updatedLabel — utils/cafeteriaFormat.formatUpdated 결과
 * @param {number} selectedIdx
 * @param {(idx: number) => void} onSelect
 * @param {Date} nowDate — 1분 tick으로 갱신되는 현재 시각 (CafeteriaPCLayout이 관리)
 */
export default function CafeteriaVenueRail({ cafeterias, updatedLabel, selectedIdx, onSelect, nowDate }) {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface">
      <div className="px-4 pt-[18px] pb-3 flex-shrink-0">
        <h1 className="text-page-ttl text-ink">학식</h1>
        {updatedLabel && (
          <p className="mt-1 text-caption text-mute">{updatedLabel}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 flex flex-col gap-2">
        {(cafeterias ?? []).map((c, idx) => (
          <VenueCard
            key={c.name}
            cafeteria={c}
            isSelected={idx === selectedIdx}
            onSelect={() => onSelect(idx)}
            nowDate={nowDate}
          />
        ))}
      </div>
    </div>
  )
}
