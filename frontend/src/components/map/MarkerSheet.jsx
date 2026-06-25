/**
 * MarkerSheet — 마커 탭 시 열리는 중형 바텀시트 (§6.2).
 * 시안2 "카드 분리형" 리디자인 (2026-06).
 *
 * Props:
 *   station        — { id, name, type, walkMinutes, walkMeters, boardingStatus: 'green'|'red'|null }
 *   arrivals       — [{ routeCode, routeColor, direction, minutes }]
 *   onClose        — () => void
 *   onNavigate     — () => void
 *   onDetail       — () => void
 *   onArrivalClick — (detail) => void
 *   directionControl — { direction, outboundLabel, inboundLabel, leftLabel, rightLabel, onChange, placeholder? }
 *   relatedMarkers — [{ key, name }]
 *   onRelatedMarker— (key) => void
 *
 * 빠듯(yellow) 상태 미지원 — green/red 두 단계만.
 * ETA 색상: ≤3분 imminent / 일반 ink (amber 중간 단계 없음).
 */

import { useEffect, useRef, useState } from 'react'
import { MapPin, Star, StarOff, X, Navigation, Info, ChevronRight } from 'lucide-react'
import { ROUTE_COLOR_MAP } from './MarkerChip'
import useAppStore from '../../stores/useAppStore'
import RouteSpine from './RouteSpine'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

// boardingStatus: green(여유) / red(서두르세요) 두 단계
// yellow(빠듯)은 의도적으로 제거
const STATUS_DOT = {
  green: { color: 'var(--tj-ease)',     label: '여유 있어요' },
  red:   { color: 'var(--tj-imminent)', label: '서두르세요'  },
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

/** ETA 텍스트 색 — imminent(≤3분) / 일반(ink) 두 단계 */
function etaColor(min) {
  if (typeof min === 'number' && min <= 3) return 'var(--tj-imminent)'
  return 'var(--tj-ink)'
}

export default function MarkerSheet({
  station,
  arrivals = [],
  onClose,
  onNavigate,
  onDetail,
  onArrivalClick,
  directionControl = null,
  relatedMarkers = [],
  onRelatedMarker,
}) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const sheetRef = useRef(null)

  // 즐겨찾기
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)
  const isFav = station?.id
    ? (favorites?.stations ?? []).includes(String(station.id))
    : false

  // 마운트 시 슬라이드업 애니메이션
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // 포인터 드래그
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
      setExpanded(true)
    } else if (delta > 50) {
      if (expanded) setExpanded(false)
      else handleClose()
    }
  }

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 320)
  }

  if (!station) return null

  const sheetHeight = expanded
    ? '90vh'
    : directionControl
      ? '54vh'
      : relatedMarkers.length > 0
        ? '50vh'
        : '42vh'

  const isPC =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const transform = visible
    ? 'translate(0, 0)'
    : isPC
      ? 'translateX(-100%)'
      : 'translateY(100%)'

  const statusInfo = station.boardingStatus ? STATUS_DOT[station.boardingStatus] : null
  const groups = groupArrivalsByRoute(arrivals)

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

      {/* 시트 본체 */}
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 md:right-auto md:w-[38%] md:bottom-[56px] md:top-0 z-[100] flex flex-col overflow-hidden"
        style={{
          background: 'var(--tj-surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderRight: isPC ? '1px solid var(--tj-line)' : undefined,
          borderTop: isPC ? undefined : '1px solid var(--tj-line)',
          height: sheetHeight,
          ...(isPC ? { height: 'auto' } : {}),
          transform,
          transition: `transform 0.3s ${EASE}, height 0.3s ${EASE}`,
          boxShadow: isPC
            ? '0 6px 24px rgba(27,42,74,.12)'
            : '0 -8px 24px rgba(27,42,74,.10)',
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
      >
        {/* 드래그 핸들 (모바일) */}
        <div className="flex justify-center pt-3.5 pb-1 flex-shrink-0 md:hidden">
          <div
            style={{
              width: 38,
              height: 4,
              borderRadius: 999,
              background: 'var(--tj-line)',
            }}
          />
        </div>

        {/* ── 헤더 ── */}
        <div
          className="flex items-start gap-2.5 px-[18px] pt-2 pb-3.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--tj-line)' }}
        >
          {/* 핀 아이콘 원형 배지 */}
          <div
            className="flex-none flex items-center justify-center mt-[1px]"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--tj-accent-bg)',
              color: 'var(--tj-accent-ink)',
            }}
          >
            <MapPin size={15} strokeWidth={2.2} />
          </div>

          {/* 정류장명 + 메타 */}
          <div className="flex-1 min-w-0">
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'var(--tj-ink)',
                lineHeight: 1.2,
              }}
            >
              {station.name}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* 탑승 상태: green(여유) / red(서두르세요) — yellow 없음 */}
              {statusInfo && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 14,
                    fontWeight: 700,
                    color: statusInfo.color,
                    letterSpacing: '-0.01em',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: statusInfo.color,
                      flexShrink: 0,
                    }}
                  />
                  {statusInfo.label}
                </span>
              )}

              {/* 도보 정보 */}
              {(station.walkMinutes != null || station.walkMeters != null) && (
                <span
                  style={{
                    fontSize: 14,
                    color: 'var(--tj-mute)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  도보{' '}
                  {station.walkMinutes != null && (
                    <strong style={{ color: 'var(--tj-ink-2)', fontWeight: 700 }}>
                      {station.walkMinutes}분
                    </strong>
                  )}
                  {station.walkMinutes != null && station.walkMeters != null && ' · '}
                  {station.walkMeters != null && (
                    <strong style={{ color: 'var(--tj-ink-2)', fontWeight: 700 }}>
                      {station.walkMeters}m
                    </strong>
                  )}
                </span>
              )}
            </div>
          </div>

          {/* 즐겨찾기 + 닫기 */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid var(--tj-line)',
                background: isFav ? '#FBF4E5' : 'var(--tj-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: isFav ? '#C2902E' : 'var(--tj-mute)',
              }}
              onClick={() => station.id && toggleFavoriteStation(String(station.id))}
              aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              {isFav
                ? <Star size={16} strokeWidth={2} fill="currentColor" />
                : <StarOff size={16} strokeWidth={2} />
              }
            </button>
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '1px solid var(--tj-line)',
                background: 'var(--tj-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--tj-mute)',
              }}
              onClick={handleClose}
              aria-label="닫기"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* ── 방향 토글 + RouteSpine ── */}
        {directionControl && (
          <div
            className="px-[18px] pt-3 pb-2 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--tj-line)' }}
          >
            <RouteSpine
              leftLabel={directionControl.leftLabel}
              rightLabel={directionControl.rightLabel}
              activeSide={directionControl.activeSide}
            />
            {/* 방향 토글 pill */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--tj-line)',
                borderRadius: 999,
                padding: 3,
                gap: 2,
                marginTop: 8,
              }}
            >
              {[
                { key: 'outbound', label: directionControl.outboundLabel },
                { key: 'inbound',  label: directionControl.inboundLabel },
              ].map((seg) => {
                const active = directionControl.direction === seg.key
                return (
                  <button
                    key={seg.key}
                    onClick={() => directionControl.onChange(seg.key)}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: active ? 800 : 700,
                      letterSpacing: '-0.01em',
                      color: active ? 'var(--tj-ink)' : 'var(--tj-mute)',
                      background: active ? 'var(--tj-surface)' : 'transparent',
                      padding: '6px 14px',
                      borderRadius: 999,
                      boxShadow: active ? '0 1px 3px rgba(27,42,74,.12)' : 'none',
                      transition: 'background 0.15s, color 0.15s',
                      minHeight: 36,
                    }}
                  >
                    {seg.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 여기로 오는 버스 (로컬 허브) ── */}
        {relatedMarkers.length > 0 && (
          <div
            className="px-[18px] pt-3 pb-2.5 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--tj-line)' }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--tj-mute)',
                letterSpacing: '0.02em',
                marginBottom: 8,
              }}
            >
              여기로 오는 버스
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {relatedMarkers.map((rm) => (
                <button
                  key={rm.key}
                  onClick={() => onRelatedMarker?.(rm.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: '1px solid var(--tj-line)',
                    background: 'var(--tj-surface)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--tj-ink)',
                    cursor: 'pointer',
                    minHeight: 44,
                  }}
                >
                  {rm.name}
                  <ChevronRight size={12} color="var(--tj-mute)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 도착 리스트 (시안2 카드 분리형) ── */}
        <div className="flex-1 overflow-y-auto px-[18px] py-3">
          {arrivals.length === 0 ? (
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--tj-mute)',
                textAlign: 'center',
                padding: '16px 0',
              }}
            >
              {directionControl?.placeholder ?? '도착 정보가 없습니다'}
            </p>
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column' }}>
              {groups.map((group, idx) => {
                const color = resolveColor(group.routeCode, group.routeColor)
                const clickable = !!(onArrivalClick && group.detail)
                const routeLabel = (group.routeCode ?? '').split(':')[0]

                // 시안2: 노선색 리드블록(배지) + 방향/ETA 본문 행
                const rowContent = (
                  <>
                    {/* 좌측: 노선 배지 (시안2의 "리드블록") */}
                    <span
                      style={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 44,
                        height: 36,
                        borderRadius: 10,
                        padding: '0 8px',
                        background: color,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                      }}
                    >
                      {routeLabel}
                    </span>

                    {/* 중앙: 방향 */}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 15,
                        fontWeight: 700,
                        color: 'var(--tj-ink)',
                        letterSpacing: '-0.01em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'left',
                      }}
                    >
                      {group.direction ?? ''}
                    </span>

                    {/* 우측: ETA — imminent(≤3분) / 일반 두 단계 */}
                    <div
                      style={{
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {group.allMinutes.slice(0, 3).map((min, i) => (
                        <span
                          key={i}
                          data-eta
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                            color: etaColor(min),
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {typeof min === 'number' ? (
                            <>
                              {min}
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: 'var(--tj-mute)',
                                  marginLeft: 1,
                                }}
                              >
                                분
                              </span>
                            </>
                          ) : (
                            (min ?? '—')
                          )}
                        </span>
                      ))}
                    </div>

                    {clickable && (
                      <ChevronRight size={14} color="var(--tj-mute)" style={{ flexShrink: 0 }} />
                    )}
                  </>
                )

                const rowStyle = {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '10px 2px',
                  minHeight: 56,
                  ...(idx > 0 ? { borderTop: '1px solid var(--tj-line)' } : {}),
                }

                return (
                  <li key={group.routeCode}>
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onArrivalClick(group.detail)}
                        style={{
                          ...rowStyle,
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: 10,
                          transition: 'background 0.12s',
                        }}
                        aria-label={`${group.routeCode} 상세 시간표 보기`}
                      >
                        {rowContent}
                      </button>
                    ) : (
                      <div style={rowStyle}>
                        {rowContent}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* ── 하단 액션 버튼 ── */}
        <div
          className="flex gap-2.5 px-[18px] pb-6 pt-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--tj-line)' }}
        >
          {/* 걸어가기 — 주 액션 */}
          <button
            style={{
              flex: 1,
              height: 46,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: 13,
              border: '1px solid var(--tj-line)',
              background: 'var(--tj-surface)',
              color: 'var(--tj-ink-2)',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'opacity 0.12s',
            }}
            onClick={onNavigate}
          >
            <Navigation size={15} strokeWidth={2.4} />
            걸어가기
          </button>

          {/* 상세 보기 — 강조 액션 */}
          <button
            style={{
              flex: 1,
              height: 46,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              borderRadius: 13,
              border: 'none',
              background: 'var(--tj-accent)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'opacity 0.12s',
            }}
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
