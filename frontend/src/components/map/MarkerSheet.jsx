/**
 * MarkerSheet — 마커 탭 시 열리는 중형 바텀시트 (§6.2).
 * 시안2 "카드 분리형" 리디자인 (2026-06).
 * Phase C(2026-07): 제스처 레이어를 vaul(Drawer)로 교체 — 스와이프 다운(모바일)/
 * 왼쪽으로 스와이프(PC 패널)로 닫힌다. 기존 헤더/본문/액션 UI는 그대로 유지.
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

import { useEffect, useState } from 'react'
import { Drawer } from 'vaul'
import { MapPin, Star, StarOff, X, Navigation, Info, ChevronRight } from 'lucide-react'
import { ROUTE_COLOR_MAP } from './MarkerChip'
import useAppStore from '../../stores/useAppStore'
import RouteSpine from './RouteSpine'
import { staggerStyle } from '../../utils/motion'

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
  // vaul이 닫힘 애니메이션을 끝낸 뒤에야 부모의 onClose(언마운트)를 호출한다.
  // (부모는 station이 사라지면 즉시 <MarkerSheet/> 자체를 언마운트하므로
  //  이 컴포넌트가 스스로 열림 상태를 들고 있어야 슬라이드다운을 보여줄 수 있다.)
  const [open, setOpen] = useState(true)
  const [snapIdx, setSnapIdx] = useState(0)

  // 즐겨찾기
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)
  const isFav = station?.id
    ? (favorites?.stations ?? []).includes(String(station.id))
    : false

  // 새 정류장이 열릴 때마다 확장 상태 리셋 + 열림 보장
  useEffect(() => {
    if (station) {
      setOpen(true)
      setSnapIdx(0)
    }
  }, [station?.id])

  if (!station) return null

  const isPC =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

  const defaultFraction = directionControl ? 0.54 : relatedMarkers.length > 0 ? 0.50 : 0.42
  const snapPoints = isPC ? undefined : [defaultFraction, 0.9]
  const activeSnapPoint = snapPoints ? snapPoints[snapIdx] : undefined

  function handleSetActiveSnapPoint(point) {
    if (!snapPoints) return
    const idx = snapPoints.indexOf(point)
    setSnapIdx(idx === -1 ? 0 : idx)
  }

  const statusInfo = station.boardingStatus ? STATUS_DOT[station.boardingStatus] : null
  const groups = groupArrivalsByRoute(arrivals)

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      onAnimationEnd={(isOpen) => { if (!isOpen) onClose?.() }}
      direction={isPC ? 'left' : 'bottom'}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={handleSetActiveSnapPoint}
      modal={!isPC}
      dismissible
    >
      <Drawer.Portal>
        {/* 백드롭 (모바일만 — PC는 지도 조작을 막지 않는 non-modal 패널) */}
        {!isPC && (
          <Drawer.Overlay
            className="fixed inset-0 z-[90] bg-black/30"
            style={{ transition: `opacity var(--dur-motion-sheet) var(--e-out)` }}
          />
        )}

        <Drawer.Content
          className={[
            'fixed z-[100] flex flex-col overflow-hidden outline-none bg-surface dark:bg-surface',
            isPC
              ? 'left-0 top-0 bottom-[56px] w-[38%] h-auto border-r border-line dark:border-line'
              : 'bottom-0 left-0 right-0 rounded-t-sheet border-t border-line dark:border-line',
          ].join(' ')}
          style={{
            boxShadow: isPC
              ? '0 6px 24px rgba(27,42,74,.12)'
              : '0 -8px 24px rgba(27,42,74,.10)',
          }}
        >
          <Drawer.Title className="sr-only">{station.name} 정류장 정보</Drawer.Title>

          {/* 드래그 핸들 (모바일) */}
          {!isPC && (
            <div className="flex justify-center pt-3.5 pb-1 flex-shrink-0">
              <div
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 999,
                  background: 'var(--tj-line)',
                }}
              />
            </div>
          )}

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
                className="pressable"
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
                className="pressable"
                onClick={() => setOpen(false)}
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
                        transition: 'background var(--dur-motion-base) var(--e-out), color var(--dur-motion-base) var(--e-out)',
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
                    className="pressable"
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
                            key={`${i}-${min}`}
                            data-eta
                            className="tj-number-pulse"
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
                    <li key={group.routeCode} className="tj-card-enter" style={staggerStyle(idx)}>
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => onArrivalClick(group.detail)}
                          className="pressable"
                          style={{
                            ...rowStyle,
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            borderRadius: 10,
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
              className="pressable"
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
              }}
              onClick={onNavigate}
            >
              <Navigation size={15} strokeWidth={2.4} />
              걸어가기
            </button>

            {/* 상세 보기 — 강조 액션 */}
            <button
              className="pressable"
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
              }}
              onClick={onDetail}
            >
              <Info size={15} strokeWidth={2.4} />
              상세 보기
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
