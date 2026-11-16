import { ChevronLeft } from 'lucide-react'
import { goBack } from '../../lib/nav'

/** 상세 화면 머리. 스크롤해도 위에 붙어 있어 뒤로 가기가 늘 보인다. */
export default function PageHeader({ title, sub, leading, trailing, fallback = '/' }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line-soft bg-bg/95 px-4 pb-2 pt-3 backdrop-blur-sm">
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
