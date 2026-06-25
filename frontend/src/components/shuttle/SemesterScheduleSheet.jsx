/**
 * SemesterScheduleSheet — 방학 중 학기 시간표 바텀 시트.
 * 4개 방향(본캠 등교 / 본캠 하교 / 2캠 등교 / 2캠 하교)을 탭 셀렉터로 하나씩 표시한다.
 * 방학 중에는 "학기 중 운행 시간표" 임을 명확히 안내한다.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useShuttleSemesterSchedule } from '../../hooks/useShuttle'
import ShuttleTimetable from './ShuttleTimetable'
import Skeleton from '../common/Skeleton'

// direction: 0=본캠 등교, 1=본캠 하교, 2=2캠 등교, 3=2캠 하교
const TABS = [
  { id: '0', direction: 0, label: '본캠 - 등교' },
  { id: '1', direction: 1, label: '본캠 - 하교' },
  { id: '2', direction: 2, label: '2캠 - 등교' },
  { id: '3', direction: 3, label: '2캠 - 하교' },
]

export default function SemesterScheduleSheet({ open, onClose }) {
  const overlayRef = useRef(null)
  const [activeId, setActiveId] = useState('0')

  // 전체 학기 시간표 (direction 필터 없음 — 4개 방향 한 번에)
  const { data, loading } = useShuttleSemesterSchedule(undefined)

  // 바깥 클릭 닫기
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const activeTab = TABS.find((t) => t.id === activeId) ?? TABS[0]
  const activeTimes =
    data?.directions?.find((d) => d.direction === activeTab.direction)?.times ?? null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      aria-modal="true"
      role="dialog"
      aria-label="학기 중 셔틀 시간표"
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-bg-dark rounded-t-2xl overflow-hidden"
        style={{ maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* 드래그 손잡이 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-line dark:bg-border-dark" />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="text-head font-bold text-ink dark:text-white">학기 중 운행 시간표</h2>
            {data && (
              <p className="text-body text-mute dark:text-mute-dark mt-0.5">
                {data.schedule_name} ·
                {' '}{data.valid_from} ~ {data.valid_until}
              </p>
            )}
            <p className="text-meta text-mute dark:text-mute-dark mt-1 leading-snug">
              평일 기준 시간표입니다 · 방학 중에는 운행하지 않아요
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-mute dark:text-mute-dark active:bg-line dark:active:bg-border-dark"
            aria-label="닫기"
            style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 셀렉터 — 4개를 2×2 그리드로 배치해 모바일 폭에서 누르기 쉽게 */}
        <div
          role="tablist"
          aria-label="운행 방향 선택"
          className="px-5 pb-3 flex-shrink-0 grid grid-cols-2 gap-1.5"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === activeId
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveId(tab.id)}
                className={[
                  'flex items-center justify-center rounded-xl font-semibold',
                  'text-body transition-colors duration-150 select-none',
                  isActive
                    ? 'bg-navy text-white dark:bg-accent dark:text-black'
                    : 'bg-surface-2 text-ink-2 dark:bg-surface-2-dark dark:text-mute-dark',
                ].join(' ')}
                style={{ minHeight: 44 }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* 시간표 본문 */}
        <div className="overflow-y-auto flex-1 pb-safe">
          {loading ? (
            <div className="px-5 space-y-2 py-4">
              <Skeleton height="3rem" rounded="rounded-xl" />
              <Skeleton height="3rem" rounded="rounded-xl" />
              <Skeleton height="3rem" rounded="rounded-xl" />
              <Skeleton height="3rem" rounded="rounded-xl" />
            </div>
          ) : activeTimes === null || activeTimes.length === 0 ? (
            <p className="px-5 py-4 text-body text-mute dark:text-mute-dark">
              운행 정보 없음
            </p>
          ) : (
            <ShuttleTimetable times={activeTimes} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
