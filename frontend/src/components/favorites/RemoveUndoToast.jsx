/**
 * RemoveUndoToast — 즐겨찾기 해제 되돌리기 토스트.
 *
 * components/common/DirectionAutoToast.jsx와 같은 시각 언어(bg-dock-bg/text-dock-text,
 * z-toast, 하단 독 위 고정 오프셋 + 세이프에어리어)를 그대로 따른다 — 앱 안에 토스트가
 * 여러 벌 갈라지지 않게 하기 위함이다. 이 컴포넌트는 useUndoRemove가 들고 있는
 * pending 상태를 그대로 받아 표시만 한다(상태 소유는 훅 쪽).
 *
 * @param {{ id: string, label: string } | null} pending
 * @param {() => void} onUndo
 */
export default function RemoveUndoToast({ pending, onUndo }) {
  if (!pending) return null

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 z-toast flex items-center justify-between gap-3 rounded-card bg-dock-bg px-4 py-3 text-caption font-semibold text-dock-text"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <span className="flex-1 min-w-0 truncate">
        {pending.label ? `${pending.label} ` : ''}즐겨찾기를 해제했어요
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 font-bold text-accent hover:text-accent-hover active:scale-[0.92] transition-colors duration-press ease-spring"
        aria-label="즐겨찾기 해제 되돌리기"
      >
        되돌리기
      </button>
    </div>
  )
}
