import { ChevronLeft } from 'lucide-react'
import { goBack } from '../../lib/nav'

/** 상세 화면 머리. 뒤로 가기 + 제목 + 보조 줄 */
export default function PageHeader({ title, sub, leading, trailing, fallback = '/' }) {
  return (
    <header className="px-4 pt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => goBack(fallback)}
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink active:bg-surface-3"
        >
          <ChevronLeft size={24} aria-hidden="true" />
        </button>
        {leading}
        <h1 className="min-w-0 flex-1 truncate text-f22 font-extrabold text-ink">{title}</h1>
        {trailing}
      </div>
      {sub && <p className="mt-0.5 text-f14 text-ink-2">{sub}</p>}
    </header>
  )
}
