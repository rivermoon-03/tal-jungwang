// frontend/src/components/now/GreetingText.jsx
import { useGreeting } from '../../hooks/useGreeting'

export default function GreetingText() {
  const { phase, greeting, fadeMs } = useGreeting()
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const dateLine = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })

  const greetingOpacity = phase === 'clock' ? 0 : phase === 'fading' ? 0 : 1
  const clockOpacity    = phase === 'clock' ? 1 : 0
  const transition = `opacity ${fadeMs}ms ease, filter ${fadeMs}ms ease`

  return (
    <div className="relative h-[56px] overflow-hidden">
      {/* Greeting layer — single line, nowrap */}
      <div
        aria-hidden={phase === 'clock'}
        className="absolute inset-0 flex items-center"
        style={{
          opacity: greetingOpacity,
          filter: phase === 'fading' ? 'blur(6px)' : 'blur(0px)',
          transition,
        }}
      >
        <span
          className="font-sans font-semibold text-slate-900 dark:text-slate-100"
          style={{ fontSize: 20, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}
        >
          {greeting}
        </span>
      </div>

      {/* Clock layer */}
      <div
        className="absolute inset-0 flex flex-col justify-center"
        style={{ opacity: clockOpacity, transition }}
      >
        <div
          className="font-sans text-slate-900 dark:text-slate-100 tabular-nums"
          style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
        >
          {hh}:{mm}
        </div>
        <div className="font-sans text-slate-500 dark:text-slate-400" style={{ fontSize: 12 }}>
          {dateLine}
        </div>
      </div>
    </div>
  )
}
