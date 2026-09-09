/**
 * StatusChip
 * 이모지·색 점 없이 텍스트 + 의미색만 사용한다.
 *
 * kind:
 *   realtime → accent 색 (text-accent, border-accent)
 *   ease     → ease 색 (text-ease, border-ease)
 *   crowded  → imminent 색 (text-imminent, border-imminent)
 *   neutral  → 뉴트럴 (text-mute, border-line) — 시간표 등 의미색이 없는 출처
 *   last     → 뉴트럴 (text-mute, border-line)
 *   beta     → 뉴트럴 (text-mute, border-line)
 *
 * 표는 statusChipKinds.js 에 있다. 선언되지 않은 kind 를 조용히 삼키지 않도록
 * StatusChip.test.jsx 가 src 전역의 kind= 사용처를 훑어 그 표에 있는 값인지 검사한다.
 */
import { STATUS_CHIP_KIND_CLASS } from './statusChipKinds'

export default function StatusChip({ kind = 'last', className = '', children }) {
  const kindClass = STATUS_CHIP_KIND_CLASS[kind] ?? STATUS_CHIP_KIND_CLASS.last
  const base =
    'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-chip font-medium leading-none select-none'

  return (
    <span className={[base, kindClass, className].filter(Boolean).join(' ')}>
      {/* 실시간 펄스 — 점 하나로 "살아있는" 데이터임을 보조 신호(색만으로 구분하지 않음) */}
      {kind === 'realtime' && (
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-accent animate-dot-blink" />
      )}
      {children}
    </span>
  )
}
