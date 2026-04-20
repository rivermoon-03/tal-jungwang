// frontend/src/components/now/HeroCardStack.jsx
import { useRef, useState } from 'react'

const THRESHOLD = 56  // px — commit a swipe past this delta

export default function HeroCardStack({ cards }) {
  const [idx, setIdx] = useState(0)
  const [dx, setDx] = useState(0)
  const start = useRef(null)
  const count = cards.length

  const onDown = (e) => { start.current = e.clientX ?? e.touches?.[0]?.clientX }
  const onMove = (e) => {
    if (start.current == null) return
    const x = e.clientX ?? e.touches?.[0]?.clientX
    setDx(x - start.current)
  }
  const onUp = () => {
    if (start.current == null) return
    if (dx > THRESHOLD && idx > 0)               setIdx(idx - 1)
    else if (dx < -THRESHOLD && idx < count - 1) setIdx(idx + 1)
    start.current = null
    setDx(0)
  }

  return (
    <div className="px-5">
      <div
        className="relative overflow-hidden touch-pan-y select-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          className="flex transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: `translateX(calc(${-idx * 100}% + ${dx}px))` }}
        >
          {cards.map((c, i) => (
            <div key={i} className="w-full shrink-0 px-0.5">{c}</div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="카드 페이지">
        {cards.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={idx === i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${
              idx === i ? 'w-5 bg-slate-900 dark:bg-slate-100' : 'w-1.5 bg-slate-300 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
