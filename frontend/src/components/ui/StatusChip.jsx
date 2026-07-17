/**
 * StatusChip
 * 이모지·색 점 없이 텍스트 + 의미색만 사용한다.
 *
 * kind:
 *   realtime → accent 색 (text-accent, border-accent)
 *   ease     → ease 색 (text-ease, border-ease)
 *   crowded  → imminent 색 (text-imminent, border-imminent)
 *   last     → 뉴트럴 (text-mute, border-line)
 *   beta     → 뉴트럴 (text-mute, border-line)
 */

const KIND_CLASS = {
  realtime: 'border border-accent text-accent',
  ease:     'border border-ease text-ease',
  crowded:  'border border-imminent text-imminent',
  last:     'border border-line text-mute',
  beta:     'border border-line text-mute',
}

export default function StatusChip({ kind = 'last', className = '', children }) {
  const kindClass = KIND_CLASS[kind] ?? KIND_CLASS.last
  const base =
    'inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[12px] font-medium leading-none select-none'

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
