import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/** 아래에서 올라오는 시트. 바깥 탭, Esc 로 닫힌다. 열리면 제목에 포커스. */
export default function BottomSheet({ open, title, onClose, children }) {
  const titleRef = useRef(null)

  useEffect(() => {
    if (!open) return
    titleRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-ink/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="tj-sheet-up relative max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-8 pt-2.5 md:rounded-[28px]"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-mute-2" aria-hidden="true" />
        <h2 ref={titleRef} tabIndex={-1} className="mb-3 text-f20 font-extrabold text-ink outline-none">
          {title}
        </h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
