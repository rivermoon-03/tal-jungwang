/**
 * DarkModePage — sub-page for dark mode settings.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft, Palette } from 'lucide-react'
import DarkModeSegment from './DarkModeSegment'

export default function DarkModePage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 bg-navy text-white px-4 py-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-white/10 transition-colors"
          aria-label="뒤로 가기"
        >
          <ChevronLeft size={20} />
        </button>
        <Palette size={18} />
        <h2 className="text-lg font-bold">다크모드</h2>
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
        <div className="bg-white dark:bg-slate-800 rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card p-4">
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
              className="flex gap-3 bg-white dark:bg-slate-800 rounded-[14px] border border-slate-100 dark:border-slate-700 px-4 py-3"
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
