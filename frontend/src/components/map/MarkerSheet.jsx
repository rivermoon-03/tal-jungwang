/**
 * MarkerSheet — 마커 탭 시 열리는 중형 바텀시트 (§6.2).
 * 시안2 "카드 분리형" 리디자인 (2026-06).
 * Theme2(2026-09): 제스처 레이어(vaul)를 걷어내고 ui/Sheet(정본)로 교체했다.
 * 백드롭이 bg-black/30(이 컴포넌트만)에서 bg-black/50 blur(공용)로 통일되고
 * Escape/포커스 트랩을 Sheet가 담당한다. vaul의 snapPoints(고정 높이 강제)가
 * 없어져 시트 높이가 다시 content-length(auto, max-h-[88dvh])를 따른다.
 * PC는 별도 도킹 패널 대신 같은 바텀시트를 쓰되 드래그 손잡이만 끈다.
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

import { MapPin, Star, StarOff, X, Navigation, Info, ChevronRight } from 'lucide-react'
import { DEFAULT_COLOR, ROUTE_COLOR_MAP } from './MarkerChip'
import useAppStore from '../../stores/useAppStore'
import Sheet from '../ui/Sheet'
import IconButton from '../ui/IconButton'
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
  return ROUTE_COLOR_MAP[routeCode] ?? DEFAULT_COLOR
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

/** ETA가 임박(≤3분)인지 — text-eta-num과 짝지어 쓰는 색 토큰 클래스를 고른다.
 *  (ArrivalRow.jsx/TransitCard.jsx와 같은 관례: text-eta-num + text-imminent|text-ink) */
function etaColorClass(min) {
  if (typeof min === 'number' && min <= 3) return 'text-imminent'
  return 'text-ink dark:text-ink'
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
  // 즐겨찾기
  const favorites = useAppStore((s) => s.favorites)
  const toggleFavoriteStation = useAppStore((s) => s.toggleFavoriteStation)
  const isFav = station?.id
    ? (favorites?.stations ?? []).includes(String(station.id))
    : false

  if (!station) return null

  // PC는 같은 바텀시트를 쓰되 드래그 손잡이만 끈다(마우스로 드래그해 닫을 수
  // 없으므로 손잡이가 오히려 오해를 준다) — 그 외 레이아웃은 모바일과 동일.
  const isPC =
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches

  const statusInfo = station.boardingStatus ? STATUS_DOT[station.boardingStatus] : null
  const groups = groupArrivalsByRoute(arrivals)

  return (
    <Sheet
      open
      onClose={onClose}
      label={`${station.name} 정류장 정보`}
      placement="bottom"
      showGrip={!isPC}
      className="max-h-[88dvh]"
    >
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
          <div className="text-head font-extrabold text-ink dark:text-ink">
            {station.name}
          </div>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* 탑승 상태: green(여유) / red(서두르세요) — yellow 없음 */}
            {statusInfo && (
              <span
                className="inline-flex items-center gap-[5px] text-body-sm font-bold tracking-[-0.01em]"
                style={{ color: statusInfo.color }}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 flex-shrink-0 rounded-pill"
                  style={{ background: statusInfo.color }}
                />
                {statusInfo.label}
              </span>
            )}

            {/* 도보 정보 */}
            {(station.walkMinutes != null || station.walkMeters != null) && (
              <span className="text-body-sm text-mute dark:text-mute tracking-[-0.01em]">
                도보{' '}
                {station.walkMinutes != null && (
                  <strong className="text-ink-2 dark:text-ink-2 font-bold">
                    {station.walkMinutes}분
                  </strong>
                )}
                {station.walkMinutes != null && station.walkMeters != null && ' · '}
                {station.walkMeters != null && (
                  <strong className="text-ink-2 dark:text-ink-2 font-bold">
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
          <IconButton
            label="닫기"
            variant="surface"
            className="rounded-full border border-line dark:border-line"
            onClick={onClose}
          >
            <X size={16} strokeWidth={2.2} />
          </IconButton>
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
                  type="button"
                  onClick={() => directionControl.onChange(seg.key)}
                  className={[
                    'min-h-[36px] rounded-pill border-none cursor-pointer px-3.5',
                    'text-body-sm tracking-[-0.01em] transition-colors duration-base ease-out',
                    active
                      ? 'font-extrabold text-ink dark:text-ink bg-surface dark:bg-surface shadow-sh-card'
                      : 'font-bold text-mute dark:text-mute bg-transparent',
                  ].join(' ')}
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
          <p className="text-caption font-extrabold text-mute dark:text-mute tracking-[0.02em] mb-2">
            여기로 오는 버스
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {relatedMarkers.map((rm) => (
              <button
                key={rm.key}
                onClick={() => onRelatedMarker?.(rm.key)}
                className="pressable inline-flex items-center gap-1 min-h-[44px] rounded-pill border border-line dark:border-line bg-surface dark:bg-surface px-3 text-caption font-bold text-ink dark:text-ink cursor-pointer"
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
          <p className="text-label font-semibold text-mute dark:text-mute text-center py-4">
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
                    className="text-caption font-extrabold leading-none tracking-[-0.02em]"
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
                    }}
                  >
                    {routeLabel}
                  </span>

                  {/* 중앙: 방향 */}
                  <span
                    className="text-list-nm text-ink dark:text-ink tracking-[-0.01em]"
                    style={{
                      flex: 1,
                      minWidth: 0,
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
                        className={`text-eta-num tabular-nums whitespace-nowrap tj-number-pulse ${etaColorClass(min)}`}
                      >
                        {typeof min === 'number' ? (
                          <>
                            {min}
                            <span className="text-caption font-bold text-mute dark:text-mute ml-px">
                              분
                            </span>
                          </>
                        ) : (
                          // 숫자가 아니면 상태 문자열 그대로, 값이 없으면 짧은 하이픈
                          // 자리표시(UI 렌더 텍스트에 em-dash 금지 — nextShuttleBus.js와 동일 관례)
                          (min ?? '-')
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
          className="pressable text-label font-extrabold tracking-[-0.01em]"
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
            cursor: 'pointer',
          }}
          onClick={onNavigate}
        >
          <Navigation size={15} strokeWidth={2.4} />
          걸어가기
        </button>

        {/* 상세 보기 — 강조 액션 */}
        <button
          className="pressable text-label font-extrabold tracking-[-0.01em]"
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
            cursor: 'pointer',
          }}
          onClick={onDetail}
        >
          <Info size={15} strokeWidth={2.4} />
          상세 보기
        </button>
      </div>
    </Sheet>
  )
}
