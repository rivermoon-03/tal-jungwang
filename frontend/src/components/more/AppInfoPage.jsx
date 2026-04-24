/**
 * AppInfoPage — 앱 정보 sub-page.
 * 'Made by moonlandingplan' 크레딧 + 빌드 시점에 주입된 앱 버전을 표시한다.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, Heart } from 'lucide-react'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'

export default function AppInfoPage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark animate-slide-in-right">
      {/* header — DarkModePage와 통일된 스타일 */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">앱 정보</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-28 md:pb-6 flex flex-col gap-4">
        <section
          className="bg-white dark:bg-surface-dark rounded-2xl p-4 flex items-center gap-3"
          style={{ border: '1px solid var(--tj-line)' }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--tj-bg-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tj-accent)',
            }}
            aria-hidden="true"
          >
            <Heart size={18} fill="currentColor" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Made by moonlandingplan
            </p>
            <p className="text-xs text-slate-500 mt-0.5">한국공대 · v{APP_VERSION}</p>
          </div>
        </section>
      </div>
    </div>
  )
}
