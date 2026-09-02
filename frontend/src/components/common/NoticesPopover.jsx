import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Megaphone } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'
import { isNoticeUnread, markNoticesSeen } from '../../utils/noticeReadState'
import IconButton from '../ui/IconButton'
import ErrorState from '../ui/ErrorState'
import EmptyState from '../ui/EmptyState'
import Skeleton from './Skeleton'

const APP_NOTICE_CATEGORY = 'app'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

const POPOVER_WIDTH = 340
const VIEWPORT_MARGIN = 12

// 알림(벨) 버튼에서 플로팅으로 뜨는 컴팩트 공지사항 팝오버.
// anchorRef(벨 버튼)의 위치를 기준으로 화면 안에 들어오도록 붙여 띄운다 —
// 지도 화면을 절반씩 덮는 큰 드로어가 아니라 벨 근처의 작은 카드로 유지한다.
// 외부 클릭 / ESC / X 버튼으로 닫힘.

export default function NoticesPopover({ open, onClose, anchorRef }) {
  const popRef = useRef(null)
  const { data, loading, error, refetch } = useNotices()
  const notices = Array.isArray(data) ? data : []
  const [style, setStyle] = useState(null)

  // 벨 버튼 기준으로 팝오버 위치를 계산한다. 뷰포트를 벗어나지 않게 clamp.
  useLayoutEffect(() => {
    if (!open) return
    const anchor = anchorRef?.current
    if (!anchor) return

    const compute = () => {
      const rect = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      let left = rect.right + 10
      // 벨 오른쪽에 붙일 공간이 부족하면(사이드바 협소 등) 벨 위쪽에 띄운다.
      if (left + POPOVER_WIDTH + VIEWPORT_MARGIN > vw) {
        left = Math.min(rect.left, vw - POPOVER_WIDTH - VIEWPORT_MARGIN)
      }
      left = Math.max(VIEWPORT_MARGIN, left)

      const maxHeight = vh - VIEWPORT_MARGIN * 2
      let top = rect.top
      if (top + maxHeight / 2 > vh - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, vh - VIEWPORT_MARGIN - Math.min(maxHeight, 420))
      }

      setStyle({ left, top, maxHeight: Math.min(maxHeight, 420) })
    }

    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [open, anchorRef])

  // ESC 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // 외부 클릭 닫기 (anchor와 popover 외부)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      const p = popRef.current
      const a = anchorRef?.current
      if (p && p.contains(e.target)) return
      if (a && a.contains(e.target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open, onClose, anchorRef])

  // 닫힐 때 "확인함"으로 기록한다(열자마자 기록하면 위치 계산 useLayoutEffect가
  // 만드는 재렌더와 경합해 안읽음 도트가 화면에 뜨기도 전에 사라진다 — 열려 있는
  // 동안은 도트를 그대로 보여주고, 실제로 닫을 때에만 로컬(localStorage)에 남긴다).
  const wasOpenRef = useRef(open)
  useEffect(() => {
    if (wasOpenRef.current && !open && !loading && !error && notices.length > 0) {
      markNoticesSeen(APP_NOTICE_CATEGORY, notices.map((n) => n.id))
    }
    wasOpenRef.current = open
    // notices는 매 렌더 새 배열이라 data(원본 참조)로만 의존한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, loading, error])

  if (!open) return null

  // 위치 계산 전 첫 프레임엔 벨 근처(우하단 폴백)에 숨겨 그린다 — 계산이
  // 끝나면(useLayoutEffect) 바로 정확한 위치로 보이므로 깜빡임이 없다.
  const positionStyle = style
    ? { left: style.left, top: style.top, maxHeight: style.maxHeight, visibility: 'visible' }
    : { right: 20, bottom: 76, maxHeight: 420, visibility: 'hidden' }

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label="공지사항"
      style={positionStyle}
      className="fixed z-popover flex w-[340px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-card border border-line bg-dock-bg shadow-dock animate-fade-in"
    >
      {/* 헤더 */}
      <header className="flex items-center gap-2 pl-4 pr-2 py-1 border-b border-line shrink-0">
        <Megaphone size={16} className="text-accent" aria-hidden="true" />
        <h2 className="flex-1 text-body-sm font-semibold text-white tracking-[-0.02em]">공지사항</h2>
        <IconButton
          label="닫기"
          onClick={onClose}
          className="text-dock-text-mute hover:text-white hover:bg-dock-active-bg"
        >
          <X size={16} />
        </IconButton>
      </header>

      {/* 본문 — 로딩/에러/빈/정상 넷을 서로 다른 모양으로 구분한다. */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-card bg-surface border border-line px-3.5 py-3 space-y-2">
                <Skeleton height="0.8rem" width="70%" />
                <Skeleton height="0.7rem" />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <ErrorState message="공지사항을 불러오지 못했어요" onRetry={refetch} className="py-8" />
        )}
        {!loading && !error && notices.length === 0 && (
          <EmptyState icon={<Megaphone size={22} aria-hidden="true" />} title="새 공지사항이 없어요" className="py-8" />
        )}
        {!loading && !error && notices.length > 0 && (
          <div className="flex flex-col gap-2">
            {notices.map((n) => {
              const unread = isNoticeUnread(APP_NOTICE_CATEGORY, n.id)
              return (
                <article
                  key={n.id}
                  className="rounded-card bg-surface border border-line px-3.5 py-3"
                >
                  <div className="flex items-baseline gap-2 mb-1">
                    {/* 안읽음 도트 — 읽은 항목도 자리는 그대로 비워 정렬이 흔들리지 않는다. */}
                    <span
                      aria-hidden="true"
                      className={`h-[7px] w-[7px] flex-shrink-0 rounded-full self-center ${unread ? 'bg-accent' : ''}`}
                    />
                    <h3 className="flex-1 text-mini-ttl font-semibold text-white tracking-[-0.01em] leading-tight">
                      {n.title}
                    </h3>
                    <span className="text-caption text-dock-text-mute font-semibold shrink-0">
                      {fmtDate(n.created_at)}
                    </span>
                  </div>
                  <p className="text-meta font-normal leading-relaxed text-dock-text whitespace-pre-line">
                    {(n.content ?? '').replace(/\\n/g, '\n')}
                  </p>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
