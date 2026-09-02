/**
 * FavoritesTimeline — 즐겨찾기 수직 타임라인 뷰 (디자인 번들 FavoritesC).
 *
 * Props:
 *   items   [{ id, routeCode, stationName, destination, minutes, lastTrain, detail }]
 *   onOpenDetail  (detail) => void
 *   onRemove      (id) => void  — 즐겨찾기 해제(토글). FavoritesList와 동일한
 *                                 오버플로 메뉴를 제공한다(기본 탭인데 삭제 수단이
 *                                 아예 없었다).
 *
 * minutes ASC 정렬. 3분 이하는 ring=accent, urgent pulse.
 */
import { useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import RouteBadge from '../common/RouteBadge.jsx'
import IconButton from '../ui/IconButton.jsx'
import useUndoRemove from './useUndoRemove'
import RemoveUndoToast from './RemoveUndoToast'
import { scaledPx } from '../../utils/fontScale'

function resolveDirection(item) {
  const parts = []
  if (item.destination) parts.push(item.destination)
  if (item.stationName) parts.push(item.stationName)
  return parts.length ? parts.join(' · ') : null
}

export default function FavoritesTimeline({ items = [], onOpenDetail, onRemove }) {
  const [openMenu, setOpenMenu] = useState(null)
  // 목록 뷰(FavoritesList)에는 해제 수단이 있는데 기본 탭인 이 뷰에는 없었다 —
  // 같은 되돌리기 토스트 훅을 재사용해 두 뷰의 해제 경험을 맞춘다.
  const { pending, remove, undo } = useUndoRemove(onRemove ?? (() => {}))

  const sorted = [...items].sort((a, b) => {
    const am = a.minutes == null ? Number.POSITIVE_INFINITY : a.minutes
    const bm = b.minutes == null ? Number.POSITIVE_INFINITY : b.minutes
    return am - bm
  })

  if (sorted.length === 0 && !pending) return null

  return (
    <div style={{ position: 'relative', padding: '4px 4px 0' }}>
      {/* vertical line */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 14,
          top: 12,
          bottom: 12,
          width: 2,
          background: 'var(--tj-line)',
        }}
      />
      {sorted.map((item) => {
        const m = item.minutes
        const hasMin = m != null && Number.isFinite(m)
        const urgent = hasMin && m <= 3
        const direction = resolveDirection(item)
        const menuOpen = openMenu === item.id

        return (
          <div key={item.id} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => onOpenDetail?.(item.detail)}
              className="pressable"
              style={{
                position: 'relative',
                display: 'block',
                width: '100%',
                textAlign: 'left',
                paddingLeft: 36,
                // 우측 44px는 오버플로 버튼 히트영역 자리 — 텍스트가 그 아래 깔리지 않게 비운다.
                paddingRight: 44,
                paddingBottom: 16,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {/* dot */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 8,
                  top: 6,
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: urgent ? 'var(--tj-accent)' : 'var(--tj-bg-soft)',
                  border: `2.5px solid ${urgent ? 'var(--tj-accent)' : 'var(--tj-line)'}`,
                  boxShadow: '0 0 0 3px var(--tj-bg-soft)',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {hasMin && (
                  <span
                    className={urgent ? 'tj-urgent' : ''}
                    style={{
                      fontSize: scaledPx(22),
                      fontWeight: 900,
                      letterSpacing: '-0.03em',
                      color: urgent ? 'var(--tj-accent)' : 'var(--tj-ink)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {m}
                  </span>
                )}
                {/* 분 없음일 땐 자리표시 대시 없이 "정보 없음" 텍스트만 남긴다(UI 렌더 텍스트에 em-dash 금지) */}
                <span style={{ fontSize: scaledPx(12), fontWeight: 700, color: 'var(--tj-mute)' }}>
                  {hasMin ? '분 뒤' : '정보 없음'}
                </span>
                {item.lastTrain && (
                  <span
                    style={{
                      fontSize: scaledPx(12),
                      fontWeight: 900,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: 'var(--line-express)',
                      color: '#fff',
                      letterSpacing: '0.08em',
                      marginLeft: 4,
                    }}
                  >
                    막차
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <RouteBadge route={item.routeCode} variant="chip" size="sm" />
                {direction && (
                  <span
                    style={{
                      fontSize: scaledPx(12),
                      color: 'var(--tj-mute)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {direction}
                  </span>
                )}
              </div>
            </button>

            <div style={{ position: 'absolute', right: 0, top: 0 }}>
              <IconButton
                label="편집 메뉴"
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenu(menuOpen ? null : item.id)
                }}
              >
                <MoreVertical size={16} />
              </IconButton>
            </div>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                <div
                  className="absolute right-0 top-11 z-30 bg-white dark:bg-surface rounded-tile shadow-sh-lift overflow-hidden min-w-[140px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    onClick={() => {
                      remove(item.id, item.routeCode)
                      setOpenMenu(null)
                    }}
                  >
                    <Trash2 size={15} />
                    즐겨찾기 해제
                  </button>
                </div>
              </>
            )}
          </div>
        )
      })}
      <RemoveUndoToast pending={pending} onUndo={undo} />
    </div>
  )
}
