/**
 * DarkModePage — sub-page for dark mode settings.
 * Props:
 *   onBack  () => void
 */
import { ChevronLeft } from 'lucide-react'
import DarkModeSegment from './DarkModeSegment'

export default function DarkModePage({ onBack }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg-dark animate-slide-in-right">
      <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="뒤로"
          className="p-2 -ml-2 rounded-full hover:bg-line dark:hover:bg-line-dark transition-colors"
        >
          <ChevronLeft size={22} className="text-ink dark:text-ink-dark" />
        </button>
        <h1 className="text-panel-ttl text-ink dark:text-ink-dark">다크모드</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 md:pb-6 flex flex-col gap-4">
        {/* explainer */}
        <p className="text-meta font-semibold text-mute dark:text-mute-dark leading-relaxed px-1">
          라이트·다크 모드를 선택하거나, 기기 설정에 맞게 자동으로 전환합니다. 선택한 설정은 기기에 저장됩니다.
        </p>

        {/* segment control */}
        <div className="bg-surface dark:bg-surface-dark rounded-card shadow-card p-4">
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
              className="flex gap-3 bg-surface dark:bg-surface-dark rounded-card shadow-card px-4 py-3"
            >
              <p className="text-meta font-extrabold text-ink dark:text-ink-dark w-12 flex-shrink-0">{title}</p>
              <p className="text-meta font-medium text-mute dark:text-mute-dark leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
