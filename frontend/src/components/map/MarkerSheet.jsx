/**
 * MarkerSheet — 마커 탭 시 열리는 중형 바텀시트 (§6.2).
 *
 * Props:
 *   station   — { id, name, type: 'bus'|'subway'|'shuttle', walkMinutes, walkMeters, boardingStatus: 'green'|'yellow'|'red'|null }
 *   arrivals  — [{ routeCode, routeColor, direction, minutes }] (최대 3개)
 *   onClose   — () => void
 *   onNavigate— () => void  (길찾기 버튼)
 *   onDetail  — () => void  (상세 보기 버튼)
 *
 * 드래그: Framer Motion 없음 → pointerdown 기반 단순 상태 토글 (half ↔ full).
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Star, StarOff, X, Navigation, Info } from 'lucide-react'
import { ROUTE_COLOR_MAP } from './MarkerChip'
import useAppStore from '../../stores/useAppStore'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const STATUS_DOT = {
  green:  { bg: '#22c55e', label: '여유' },
  yellow: { bg: '#f59e0b', label: '빠듯' },
  red:    { bg: '#ef4444', label: '서두르세요' },
}

function resolveColor(routeCode, routeColor) {
  if (routeColor) return routeColor
  return ROUTE_COLOR_MAP[routeCode] ?? '#1b3a6e'
}

export default function MarkerSheet({ station, arrivals = [], onClose, onNavigate, onDetail }) {
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

  const sheetHeight = expanded ? '90vh' : '42vh'
  const translateY = visible ? '0%' : '100%'

  return (
    <>
      {/* 백드롭 */}
      <div
        className="fixed inset-0 z-[90]"
        style={{
          background: 'rgba(0,0,0,0.3)',
          opacity: visible ? 1 : 0,
          transition: `opacity 0.3s ${EASE}`,
        }}
        onClick={handleClose}
      />

      {/* 시트 */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-[100] bg-white dark:bg-[#272a33] rounded-t-[18px] flex flex-col overflow-hidden"
        style={{
          height: sheetHeight,
          transform: `translateY(${translateY})`,
          transition: `transform 0.3s ${EASE}, height 0.3s ${EASE}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-600" />
        </div>

        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 pt-2 pb-3 flex-shrink-0 border-b border-[#ebebeb] dark:border-[#3a3e48]">
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            {/* 정류장명 + 탑승 상태 */}
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-coral flex-shrink-0" />
              <span className="text-[15px] font-bold text-[#0f172a] dark:text-[#f1f5f9] truncate">
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
              <span className="text-[12px] text-[#717171] dark:text-[#94a3b8] pl-5">
                도보{' '}
                {station.walkMinutes != null ? `${station.walkMinutes}분` : ''}
                {station.walkMinutes != null && station.walkMeters != null ? ' · ' : ''}
                {station.walkMeters != null ? `${station.walkMeters}m` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {/* 즐겨찾기 토글 */}
            <button
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={() => station.id && toggleFavoriteStation(String(station.id))}
              aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              {isFav
                ? <Star size={18} className="text-coral fill-coral" />
                : <StarOff size={18} className="text-slate-400" />
              }
            </button>
            {/* 닫기 */}
            <button
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              onClick={handleClose}
              aria-label="닫기"
            >
              <X size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {/* 도착 리스트 */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {arrivals.length === 0 ? (
            <p className="text-[13px] text-[#717171] dark:text-[#94a3b8] text-center py-4">
              도착 정보가 없습니다
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {arrivals.slice(0, 3).map((arr, i) => {
                const color = resolveColor(arr.routeCode, arr.routeColor)
                return (
                  <li key={i} className="flex items-center gap-3">
                    {/* 노선 색 원 */}
                    <span
                      className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-bold"
                      style={{ background: color }}
                    >
                      {(arr.routeCode ?? '').slice(0, 3)}
                    </span>

                    {/* 방향 */}
                    <span className="flex-1 text-[13px] text-[#0f172a] dark:text-[#f1f5f9] truncate">
                      {arr.direction ?? ''}
                    </span>

                    {/* 남은 시간 */}
                    <span
                      className="flex-shrink-0 text-[13px] font-bold"
                      style={{ color: arr.minutes <= 3 ? '#ef4444' : arr.minutes <= 7 ? '#f59e0b' : '#1b3a6e' }}
                    >
                      {arr.minutes != null ? `${arr.minutes}분` : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-3 px-5 pb-6 pt-2 flex-shrink-0 border-t border-[#ebebeb] dark:border-[#3a3e48]">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-navy text-white text-[14px] font-semibold"
            style={{ background: '#1b3a6e' }}
            onClick={onNavigate}
          >
            <Navigation size={15} />
            길찾기
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#ebebeb] dark:border-[#3a3e48] text-[#0f172a] dark:text-[#f1f5f9] text-[14px] font-semibold bg-white dark:bg-[#272a33]"
            onClick={onDetail}
          >
            <Info size={15} />
            상세 보기
          </button>
        </div>
      </div>
    </>
  )
}
