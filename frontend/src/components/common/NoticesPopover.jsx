import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Megaphone } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

// PC dock 우측 알림 버튼에서 플로팅으로 뜨는 공지사항 팝오버.
// 위치: dock(68px) 위, 우측 정렬.
// 외부 클릭 / ESC / X 버튼으로 닫힘.

export default function NoticesPopover({ open, onClose, anchorRef }) {
  const popRef = useRef(null)
  const { data, loading, error } = useNotices()
  const notices = Array.isArray(data) ? data : []

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

  if (!open) return null

  return createPortal(
    <div
      ref={popRef}
      role="dialog"
      aria-label="공지사항"
      className="fixed z-[200] right-5 bottom-[76px] w-[380px] max-w-[calc(100vw-40px)] max-h-[calc(100dvh-100px)] flex flex-col rounded-card overflow-hidden bg-dock-bg border border-line-dark shadow-dock animate-fade-in"
    >
      {/* 헤더 */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-line-dark shrink-0">
        <Megaphone size={16} className="text-accent" aria-hidden="true" />
        <h2 className="flex-1 text-[14px] font-black text-white tracking-[-0.02em]">공지사항</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="w-7 h-7 rounded-btn flex items-center justify-center text-dock-text-mute hover:text-white hover:bg-dock-active-bg transition-colors duration-snap ease-ios"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="text-[12px] text-dock-text-mute text-center py-10">불러오는 중…</p>
        )}
        {error && (
          <p className="text-[12px] text-imminent-dark text-center py-10">
            공지사항을 불러오지 못했어요
          </p>
        )}
        {!loading && !error && notices.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-dock-text-mute">
            <Megaphone size={22} aria-hidden="true" />
            <p className="text-[12px]">새 공지사항이 없어요</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          {notices.map((n) => (
            <article
              key={n.id}
              className="rounded-card bg-surface-dark border border-line-dark px-3.5 py-3"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="flex-1 text-[13px] font-black text-white tracking-[-0.01em] leading-tight">
                  {n.title}
                </h3>
                <span className="text-caption text-dock-text-mute font-semibold shrink-0">
                  {fmtDate(n.created_at)}
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-dock-text whitespace-pre-line">
                {(n.content ?? '').replace(/\\n/g, '\n')}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
