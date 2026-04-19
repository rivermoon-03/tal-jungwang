/**
 * DarkModePage — sub-page for dark mode settings.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft } from 'lucide-react'
import DarkModeSegment from './DarkModeSegment'

export default function DarkModePage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-bg-dark">
      {/* header — NoticesPage와 통일된 스타일 */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 bg-white dark:bg-surface-dark border-b border-slate-100 dark:border-border-dark flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ChevronLeft size={22} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">다크모드</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 pb-28 md:pb-6 flex flex-col gap-5">
        {/* explainer */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">화면 테마</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            라이트·다크 모드를 선택하거나, 기기 설정에 맞게 자동으로 전환합니다.
            선택한 설정은 기기에 저장됩니다.
          </p>
        </div>

        {/* segment control */}
        <div className="bg-white dark:bg-surface-dark rounded-[18px] border border-slate-100 dark:border-border-dark shadow-card p-4">
          <DarkModeSegment />
        </div>

        {/* description cards */}
        <div className="flex flex-col gap-2">
          {[
            { title: '라이트', desc: '항상 밝은 화면을 사용합니다.' },
            { title: '시스템', desc: '기기의 다크모드 설정에 자동으로 따릅니다. (기본값)' },
            { title: '다크', desc: '항상 어두운 화면을 사용합니다. 배터리 절약에 도움이 됩니다.' },
          ].map(({ title, desc }) => (
            <div
              key={title}
              className="flex gap-3 bg-white dark:bg-surface-dark rounded-[14px] border border-slate-100 dark:border-border-dark px-4 py-3"
            >
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 w-12 flex-shrink-0">{title}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
