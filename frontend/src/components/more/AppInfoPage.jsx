/**
 * AppInfoPage — 앱 정보 sub-page.
 * 'Made by moonlandingplan' 크레딧 + 빌드 시점에 주입된 앱 버전을 표시한다.
 * Props:
 *   onBack  () => void
 */
/* global __APP_VERSION__ -- vite.config.js의 define으로 빌드 시점에 주입된다 */
import { ChevronLeft, Heart, School } from 'lucide-react'
import IconButton from '../ui/IconButton'

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0'

export default function AppInfoPage({ onBack, embedded = false }) {
  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-slide-in-right">
      {!embedded && (
        <div className="flex items-center gap-2 px-3 pt-4 pb-3 flex-shrink-0">
          <IconButton label="뒤로" onClick={onBack}>
            <ChevronLeft size={22} className="text-ink dark:text-ink" />
          </IconButton>
          <h1 className="text-panel-ttl text-ink dark:text-ink">앱 정보</h1>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 pb-28 md:pb-6 flex flex-col gap-4">
        {/* 히어로 */}
        <section className="bg-surface dark:bg-surface rounded-card shadow-card px-5 py-6 flex flex-col items-center text-center">
          <div
            className="w-14 h-14 rounded-card flex items-center justify-center text-white mb-3"
            style={{ background: 'linear-gradient(160deg, var(--tj-accent), var(--tj-accent-hover))' }}
            aria-hidden="true"
          >
            <Heart size={22} fill="currentColor" />
          </div>
          {/* 헤더·PWA 매니페스트와 같은 이름을 쓴다. "정왕 교통 허브"는 내부
              프로젝트명이라 사용자에게는 다른 앱처럼 보였다. */}
          <p className="text-panel-ttl text-ink dark:text-ink">탈것:정왕</p>
          <span className="text-meta font-semibold text-chip-blue-fg dark:text-chip-blue-fg bg-chip-blue-bg dark:bg-chip-blue-bg px-2.5 py-1 rounded-full mt-2 tracking-wider">
            v{APP_VERSION} · BETA
          </span>
        </section>

        {/* 정보 행 */}
        <section className="bg-surface dark:bg-surface rounded-card shadow-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-line dark:border-line">
            <Heart size={16} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-meta font-bold text-mute dark:text-mute">Made by</p>
              <p className="text-label font-semibold text-ink dark:text-ink tracking-tight mt-0.5">moonlandingplan</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <School size={16} className="text-mute dark:text-mute flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-meta font-bold text-mute dark:text-mute">기관</p>
              <p className="text-label font-semibold text-ink dark:text-ink tracking-tight mt-0.5">한국공학대학교</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
