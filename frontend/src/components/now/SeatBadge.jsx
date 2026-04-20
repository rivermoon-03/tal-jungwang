// frontend/src/components/now/SeatBadge.jsx
// crowded: 1=여유, 2=보통, 3=혼잡, 4=매우혼잡, 0=정보없음
const META = {
  1: { label: '좌석 여유', cls: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300' },
  2: { label: '보통',      cls: 'text-amber-700   bg-amber-500/10   dark:text-amber-300'   },
  3: { label: '좌석 혼잡', cls: 'text-orange-700  bg-orange-500/10  dark:text-orange-300'  },
  4: { label: '매우 혼잡', cls: 'text-rose-700    bg-rose-500/10    dark:text-rose-300'    },
}

export default function SeatBadge({ level }) {
  const m = META[level]
  if (!m) return null  // no seat info → render nothing (per spec)
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${m.cls}`}>
      {m.label}
    </span>
  )
}
