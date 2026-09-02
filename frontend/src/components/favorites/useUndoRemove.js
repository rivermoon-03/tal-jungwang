/**
 * useUndoRemove — 즐겨찾기 해제를 "되돌리기" 토스트로 보완하는 공용 훅.
 *
 * FavoritesList/FavoritesTimeline 둘 다 즐겨찾기 해제가 확인도 되돌리기도 없이
 * 바로 실행돼(1탭이면 끝), 실수로 지운 걸 되돌릴 방법이 없었다. 스토어의
 * toggleFavoriteRoute/toggleFavoriteKey/toggleFavoriteStation은 모두 토글이라
 * 같은 코드로 다시 호출하면 원상복구된다 — 그래서 되돌리기는 onRemove(id)를
 * 한 번 더 부르는 것만으로 충분하다(별도 "복원" API가 필요 없다).
 *
 * @param {(id: string) => void} onRemove  상위(FavoritesPage)가 넘긴 실제 토글 액션
 * @param {number} [timeoutMs]             토스트 자동 소멸 시간
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export default function useUndoRemove(onRemove, timeoutMs = 5000) {
  const [pending, setPending] = useState(null) // { id, label } | null
  const timerRef = useRef(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const remove = useCallback((id, label) => {
    onRemove(id)
    setPending({ id, label })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setPending(null), timeoutMs)
  }, [onRemove, timeoutMs])

  const undo = useCallback(() => {
    setPending((current) => {
      if (!current) return current
      onRemove(current.id) // 토글이므로 다시 부르면 되돌아온다
      return null
    })
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [onRemove])

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPending(null)
  }, [])

  return { pending, remove, undo, dismiss }
}
