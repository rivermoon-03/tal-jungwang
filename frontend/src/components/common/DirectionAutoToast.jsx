import { Fragment, useEffect, useState } from 'react'
import useAppStore from '../../stores/useAppStore'

/**
 * DirectionAutoToast — 등하교 방향 자동 전환 토스트
 *
 * 자동 판정으로 direction 값이 바뀔 때(사용자 오버라이드가 아닌 순수 자동 전환)
 * 하단에 4초간 떠있다가 사라진다. "되돌리기" 액션으로 이전 방향으로 복원할 수 있다.
 *
 * prefers-reduced-motion을 존중해 진입/퇴장 애니메이션을 0ms로 처리한다
 * (index.css의 전역 규칙과 동일).
 *
 * 사용처: HomeWeatherHero 내부 fixed 레이어로 마운트.
 *
 * @param {string} message - 토스트 문구(예: "오후라서 하교로 전환했어요")
 * @param {string} previousDirection - 이전 방향("등교"|"하교") — 되돌리기 액션용
 * @param {boolean} visible - 표시 여부
 * @param {() => void} onClose - 토스트 사라짐 콜백 (4초 또는 되돌리기 클릭 후)
 */
export default function DirectionAutoToast({ message, previousDirection, visible, onClose }) {
  const setDirectionOverride = useAppStore((s) => s.setDirectionOverride)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (!visible || isLeaving) return
    const timer = setTimeout(() => {
      setIsLeaving(true)
    }, 4000)
    return () => clearTimeout(timer)
  }, [visible, isLeaving])

  useEffect(() => {
    if (!isLeaving) return
    const timeout = setTimeout(() => {
      onClose()
    }, 160)
    return () => clearTimeout(timeout)
  }, [isLeaving, onClose])

  const handleUndo = () => {
    setDirectionOverride(previousDirection)
    setIsLeaving(true)
  }

  if (!visible && !isLeaving) return null

  return (
    <div
      // bottom-20은 하단 독(FloatingDock) 위 고정 오프셋이다. FloatingDock처럼
      // margin-bottom으로 세이프에어리어를 더해야 홈 인디케이터가 있는 기기에서
      // 토스트가 화면 밖으로 밀리지 않는다.
      className={`fixed bottom-20 left-4 right-4 z-toast flex items-center justify-between gap-3 rounded-card bg-dock-bg px-4 py-3 text-caption font-semibold text-dock-text transition-opacity duration-160 ${
        isLeaving ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={handleUndo}
        className="shrink-0 font-bold text-accent hover:text-accent-hover active:scale-[0.92] transition-colors duration-press ease-spring"
        aria-label="되돌리기"
      >
        되돌리기
      </button>
    </div>
  )
}
