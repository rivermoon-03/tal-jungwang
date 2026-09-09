/**
 * StatusChip
 * 이모지·색 점 없이 텍스트 + 의미색만 사용한다. 실시간도 마찬가지다 — 라벨이
 * 이미 "실시간" 이라 깜빡이는 점은 같은 말을 두 번 하면서 목록을 계속 흔든다.
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
      {children}
    </span>
  )
}
