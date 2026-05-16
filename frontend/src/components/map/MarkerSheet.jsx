/**
 * MarkerSheet — 마커 탭 시 열리는 중형 바텀시트 (§6.2).
 *
 * Props:
 *   station   — { id, name, type: 'bus'|'subway'|'shuttle', walkMinutes, walkMeters, boardingStatus: 'green'|'yellow'|'red'|null }
 *   arrivals  — [{ routeCode, routeColor, direction, minutes }] (최대 3개)
 *   onClose   — () => void
 *   onNavigate— () => void  (걸어가기 버튼)
 *   onDetail  — () => void  (상세 보기 버튼)
 *
 * 드래그: Framer Motion 없음 → pointerdown 기반 단순 상태 토글 (half ↔ full).
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Star, StarOff, X, Navigation, Info, ChevronRight } from 'lucide-react'
import { ROUTE_COLOR_MAP } from './MarkerChip'
import useAppStore from '../../stores/useAppStore'
import RouteSpine from './RouteSpine'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
// state 토큰값과 동일 (state-ok / state-warn / state-bad)
const STATUS_DOT = {
  green:  { bg: '#4a9d6a', label: '여유' },
  yellow: { bg: '#d4a14a', label: '빠듯' },
  red:    { bg: '#c8553d', label: '서두르세요' },
}

function resolveColor(routeCode, routeColor) {
  if (routeColor) return routeColor
  return ROUTE_COLOR_MAP[routeCode] ?? '#1b3a6e'
}

function groupArrivalsByRoute(arrivals) {
  const map = new Map()
  for (const a of arrivals) {
    if (!map.has(a.routeCode)) {
      map.set(a.routeCode, { ...a, allMinutes: [a.minutes] })
    } else {
      map.get(a.routeCode).allMinutes.push(a.minutes)
    }
  }
  return Array.from(map.values())
}

export default function MarkerSheet({ station, arrivals = [], onClose, onNavigate, onDetail, onArrivalClick, directionControl = null, relatedMarkers = [], onRelatedMarker }) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef(null)

  // 즐겨찾기
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)
  const isFav = station?.id ? (favorites?.stations ?? []).includes(String(station.id)) : false

  // 마운트 시 슬라이드업 애니메이션
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // 포인터 드래그: 위로 → 확장, 아래로 → 닫기 또는 축소
  const dragStartY = useRef(null)
  function handlePointerDown(e) {
    dragStartY.current = e.clientY ?? e.touches?.[0]?.clientY
  }
  function handlePointerUp(e) {
    if (dragStartY.current == null) return
    const endY = e.clientY ?? e.changedTouches?.[0]?.clientY ?? dragStartY.current
    const delta = endY - dragStartY.current
    dragStartY.current = null

    if (delta < -50) {
      // 위로 50px 이상 → 확장
      setExpanded(true)
    } else if (delta > 50) {
      if (expanded) {
        setExpanded(false)
      } else {
        handleClose()
      }
    }
  }

  function handleClose() {
    setVisible(false)
    // 트랜지션 후 onClose 호출
    setTimeout(onClose, 320)
  }

  if (!station) return null

  const sheetHeight = expanded ? '90vh' : directionControl ? '54vh' : relatedMarkers.length > 0 ? '50vh' : '42vh'

  // 디바이스에 따라 transform 방향이 다름.
  // 모바일: 하단에서 위로 (translateY)
  // PC: 좌측에서 우로 (translateX)
  const isPC = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const transform = visible
    ? 'translate(0, 0)'
    : (isPC ? 'translateX(-100%)' : 'translateY(100%)')

  return (
    <>
      {/* 백드롭 (모바일만) */}
      <div
        className="fixed inset-0 z-[90] md:hidden"
        style={{
          background: 'rgba(0,0,0,0.3)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.3s ${EASE}`,
        }}
        onClick={handleClose}
      />

      {/* 시트 — 모바일: 하단 sheet. PC: 좌측 38%, 하단 dock 56px 위. */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 md:right-auto md:w-[38%] md:bottom-[56px] md:top-0 z-[100] bg-surface dark:bg-surface-dark rounded-t-[18px] md:rounded-t-none md:rounded-r-card-pc md:border-r md:border-line dark:md:border-line-dark flex flex-col overflow-hidden"
        style={{
          height: sheetHeight,
          ...(isPC ? { height: 'auto' } : {}),
          transform,
          transition: `transform 0.3s ${EASE}, height 0.3s ${EASE}`,
          boxShadow: isPC ? '0 6px 24px rgba(0,0,0,0.12)' : '0 -4px 24px rgba(0,0,0,0.12)',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {/* 드래그 핸들 (모바일만) */}
        <div className="flex justify-center pt-3.5 pb-1.5 flex-shrink-0 md:hidden">
          <div className="w-11 h-1 rounded-full bg-mute-2 dark:bg-mute-2-dark" />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3.5 flex-shrink-0 border-b border-line dark:border-line-dark">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* 정류장명 + 탑승 상태 */}
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-accent dark:text-accent-dark flex-shrink-0" />
              <span className="text-panel-ttl text-ink dark:text-ink-dark truncate">
                {station.name}
              </span>
              {station.boardingStatus && STATUS_DOT[station.boardingStatus] && (
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                  style={{ background: STATUS_DOT[station.boardingStatus].bg }}
                  title={STATUS_DOT[station.boardingStatus].label}
                />
              )}
            </div>

            {/* 도보 정보 */}
            {(station.walkMinutes != null || station.walkMeters != null) && (
              <span className="text-meta font-semibold text-mute dark:text-mute-dark pl-6">
                도보{' '}
                {station.walkMinutes != null ? `${station.walkMinutes}분` : ''}
                {station.walkMinutes != null && station.walkMeters != null ? ' · ' : ''}
                {station.walkMeters != null ? `${station.walkMeters}m` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            {/* 즐겨찾기 토글 */}
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-line dark:hover:bg-line-dark transition-colors"
              onClick={() => station.id && toggleFavoriteStation(String(station.id))}
              aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              {isFav
                ? <Star size={18} className="text-state-warn fill-state-warn" />
                : <StarOff size={18} className="text-mute dark:text-mute-dark" />
              }
            </button>
            {/* 닫기 */}
            <button
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-line dark:hover:bg-line-dark transition-colors"
              onClick={handleClose}
              aria-label="닫기"
            >
              <X size={18} className="text-text dark:text-text-dark" />
            </button>
          </div>
        </div>

        {/* 방향 토글 + RouteSpine (bus_seoul 전용) */}
        {directionControl && (
          <div className="px-5 pt-3 pb-1 flex-shrink-0 border-b border-line dark:border-line-dark">
            <RouteSpine
              leftLabel={directionControl.leftLabel}
              rightLabel={directionControl.rightLabel}
              activeSide={directionControl.activeSide}
            />
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-line dark:bg-line-dark mt-1">
              {[
                { key: 'outbound', label: directionControl.outboundLabel },
                { key: 'inbound',  label: directionControl.inboundLabel },
              ].map((seg) => {
                const active = directionControl.direction === seg.key
                return (
                  <button
                    key={seg.key}
                    onClick={() => directionControl.onChange(seg.key)}
                    className={`py-2 rounded-lg text-meta transition-colors ${
                      active
                        ? 'bg-surface dark:bg-surface-dark text-ink dark:text-ink-dark font-black shadow-card'
                        : 'text-mute dark:text-mute-dark font-bold'
                    }`}
                  >
                    {seg.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 여기로 오는 버스 (로컬 허브 전용) */}
        {relatedMarkers.length > 0 && (
          <div className="px-5 pt-3 pb-2.5 flex-shrink-0 border-b border-line dark:border-line-dark">
            <p className="text-meta font-bold text-mute dark:text-mute-dark mb-2 tracking-wide">여기로 오는 버스</p>
            <div className="flex gap-1.5 flex-wrap">
              {relatedMarkers.map((rm) => (
                <button
                  key={rm.key}
                  onClick={() => onRelatedMarker?.(rm.key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-surface-alt dark:bg-surface-dark-alt text-meta font-bold text-ink dark:text-ink-dark active:bg-line dark:active:bg-line-dark transition-colors"
                >
                  {rm.name}
                  <ChevronRight size={12} className="text-mute dark:text-mute-dark" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 도착 리스트 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {arrivals.length === 0 ? (
            <p className="text-meta font-semibold text-mute dark:text-mute-dark text-center py-4">
              {directionControl?.placeholder ?? '도착 정보가 없습니다'}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {groupArrivalsByRoute(arrivals).map((group) => {
                const color = resolveColor(group.routeCode, group.routeColor)
                const clickable = !!(onArrivalClick && group.detail)
                const content = (
                  <>
                    {/* 노선 색 원 */}
                    <span
                      className="flex-shrink-0 inline-flex items-center justify-center min-w-[1.75rem] h-7 rounded-full px-1 text-white text-micro font-extrabold"
                      style={{ background: color }}
                    >
                      {(group.routeCode ?? '').split(':')[0]}
                    </span>

                    {/* 방향 */}
                    <span className="flex-1 text-[14px] font-semibold text-ink dark:text-ink-dark truncate text-left">
                      {group.direction ?? ''}
                    </span>

                    {/* 남은 시간 (최대 3개) */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {group.allMinutes.slice(0, 3).map((min, i) => (
                        <span
                          key={i}
                          className={`text-[14px] font-extrabold tabular-nums tracking-tight ${
                            typeof min === 'number' && min <= 3
                              ? 'text-imminent dark:text-imminent-dark'
                              : typeof min === 'number' && min <= 7
                                ? 'text-state-warn dark:text-amber-400'
                                : 'text-ink dark:text-ink-dark'
                          }`}
                        >
                          {typeof min === 'number' ? `${min}분` : (min ?? '—')}
                        </span>
                      ))}
                    </div>
                    {clickable && (
                      <ChevronRight size={14} className="text-mute-2 dark:text-mute-2-dark flex-shrink-0" />
                    )}
                  </>
                )
                return (
                  <li key={group.routeCode}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onArrivalClick(group.detail)}
                        className="w-full flex items-center gap-3 py-2.5 px-1 -mx-1 rounded-mini hover:bg-surface-alt dark:hover:bg-surface-dark-alt active:bg-line dark:active:bg-line-dark transition-colors"
                        aria-label={`${group.routeCode} 상세 시간표 보기`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3 py-2.5 px-1">
                        {content}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2.5 px-5 pb-6 pt-3 flex-shrink-0 border-t border-line dark:border-line-dark">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-mini bg-ink dark:bg-accent-dark text-white dark:text-ink text-[14px] font-black tracking-tight transition-colors pressable"
            onClick={onNavigate}
          >
            <Navigation size={15} strokeWidth={2.4} />
            걸어가기
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-mini bg-line dark:bg-line-dark text-ink dark:text-ink-dark text-[14px] font-black tracking-tight transition-colors pressable"
            onClick={onDetail}
          >
            <Info size={15} strokeWidth={2.4} />
            상세 보기
          </button>
        </div>
      </div>
    </>
  )
}
