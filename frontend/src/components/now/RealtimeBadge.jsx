// frontend/src/components/now/RealtimeBadge.jsx
import { Radio } from 'lucide-react'

export default function RealtimeBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md
                 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    >
      <Radio size={9} strokeWidth={2.4} aria-hidden="true" />
      실시간
    </span>
  )
}
