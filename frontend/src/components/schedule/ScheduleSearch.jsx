/**
 * ScheduleSearch — controlled search input for filtering routes/stations.
 * Props:
 *   value     string
 *   onChange  (value: string) => void
 *   placeholder string
 */
import { Search, X } from 'lucide-react'

export default function ScheduleSearch({ value, onChange, placeholder = '노선번호 또는 정류장 검색' }) {
  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2.5 text-sm rounded-[14px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
