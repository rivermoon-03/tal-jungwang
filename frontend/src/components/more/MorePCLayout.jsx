/**
 * MorePCLayout — 더보기(More) 탭의 PC 2열 레이아웃.
 *
 * 좌측 rail(nav 4항목 + 개인정보처리방침 링크 + 다가오는 일정 + 하단 크레딧)과
 * 우측 콘텐츠(activeNav에 따라 기존 서브페이지를 embedded로 재사용)로 구성된다.
 *
 * 우측에 렌더링하는 4개 컴포넌트(AcademicNoticesPCContent/NoticesPage/
 * SettingsPage/AppInfoPage)는 전부 기존 파일 그대로 재사용하고, "다가오는
 * 일정" 표시 로직(D-day/날짜 포맷)도 utils/academicCalendar.js 헬퍼를 그대로
 * import해 쓴다 — 인라인 재계산/복제 금지(mistakes.md 2).
 *
 * MorePage.jsx에 useIsDesktop 분기로 이 컴포넌트를 실제로 연결하는 배선은
 * 이 파일의 책임이 아니다(후속 작업).
 */
import { useState } from 'react'
import { GraduationCap, Megaphone, Settings as SettingsIcon, Info, Shield } from 'lucide-react'
import { useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange } from '../../utils/academicCalendar'
import AcademicNoticesPCContent from './AcademicNoticesPCContent'
import NoticesPage from './NoticesPage'
import SettingsPage from './SettingsPage'
import AppInfoPage from './AppInfoPage'

const NAV_ITEMS = [
  { id: 'academic', label: '학사공지', Icon: GraduationCap },
  { id: 'notices', label: '앱 공지', Icon: Megaphone },
  { id: 'settings', label: '설정', Icon: SettingsIcon },
  { id: 'app-info', label: '앱 정보', Icon: Info },
]

// 다가오는 일정에서 보여줄 최대 개수(가장 임박한 일정 next 1개 + upcoming).
const UPCOMING_MAX = 4

// embedded 서브페이지의 onBack은 rail 상단 nav 전환으로 대체되므로 실질적으로
// 호출될 일이 없다(embedded=true면 자체 헤더/뒤로가기 버튼을 렌더링하지 않음).
// 그래도 필수 prop 계약은 지켜야 해서 no-op을 명시적으로 넘긴다.
function noop() {}

// 개인정보처리방침(/privacy)은 MorePage.jsx(모바일판)와 동일한 패턴으로 이동한다 —
// 안정 URL이 필요한 페이지라 pushState + popstate 이벤트를 직접 디스패치한다.
function openPrivacyPage() {
  window.history.pushState({}, '', '/privacy')
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export default function MorePCLayout({ initialNav = 'academic' }) {
  const [activeNav, setActiveNav] = useState(initialNav)

  // AcademicNoticesPCContent도 동일 엔드포인트(/school/calendar)를 구독하지만
  // useApi가 URL 기준으로 in-flight dedup + TTL 캐시를 하므로 중복 네트워크
  // 호출이 발생하지 않는다(mistakes.md — 캐시 정합).
  const { data: calendarData } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  const scheduleItems = [next, ...upcoming].filter(Boolean).slice(0, UPCOMING_MAX)

  return (
    <div className="flex h-full min-h-0">
      {/* 좌측 rail */}
      <aside className="w-[280px] xl:w-[320px] flex-shrink-0 h-full flex flex-col bg-surface dark:bg-surface border-r border-line dark:border-line overflow-y-auto">
        <div className="px-5 pt-6 pb-4 flex-shrink-0">
          <h1
            className="text-ink dark:text-white"
            style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.03em' }}
          >
            더보기
          </h1>
        </div>

        <nav className="px-3 flex flex-col gap-1 flex-shrink-0" aria-label="더보기 메뉴">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeNav === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveNav(id)}
                aria-current={active ? 'page' : undefined}
                className={`pressable w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-label font-semibold text-left transition-colors ${
                  active
                    ? 'bg-accent-bg dark:bg-accent-bg text-accent-ink dark:text-accent-ink'
                    : 'text-ink-2 dark:text-ink-2'
                }`}
              >
                <Icon size={18} aria-hidden="true" className="flex-shrink-0" />
                {label}
              </button>
            )
          })}

          {/* AppInfoPage 내부에는 개인정보처리방침 링크가 없어(파일 확인 완료) rail에 노출한다 */}
          <button
            type="button"
            onClick={openPrivacyPage}
            className="pressable w-full flex items-center gap-3 px-3 py-2.5 rounded-button text-label font-semibold text-left text-mute dark:text-mute"
          >
            <Shield size={18} aria-hidden="true" className="flex-shrink-0" />
            개인정보처리방침
          </button>
        </nav>

        {/* 다가오는 일정 */}
        {scheduleItems.length > 0 && (
          <div className="px-4 mt-6 flex-shrink-0">
            <div
              className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
              style={{ letterSpacing: '0.14em' }}
            >
              다가오는 일정
            </div>
            <div className="flex flex-col gap-1.5">
              {scheduleItems.map((item, i) => {
                const isNext = i === 0
                return (
                  <div
                    key={`${item.title}-${item.start_date}`}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-mini"
                  >
                    <span
                      className={`text-micro font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 tabular-nums ${
                        isNext
                          ? 'bg-accent dark:bg-accent text-white'
                          : 'bg-surface-3 dark:bg-surface-3 text-ink-2 dark:text-ink-2'
                      }`}
                    >
                      {formatDday(item.start_date)}
                    </span>
                    <span className="text-caption font-semibold text-ink dark:text-ink truncate flex-1 min-w-0">
                      {item.title}
                    </span>
                    <span className="text-micro font-semibold text-mute dark:text-mute flex-shrink-0 whitespace-nowrap tabular-nums">
                      {formatDateOrRange(item.start_date, item.end_date)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* 하단 크레딧 — AppInfoPage의 실제 표시 텍스트("Made by moonlandingplan")와
            동일 문구로 맞춘다(단일 출처, mistakes.md 2). */}
        <div className="px-5 py-4 flex-shrink-0 text-center">
          <p className="text-caption font-semibold text-mute dark:text-mute">Made by moonlandingplan</p>
        </div>
      </aside>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 min-w-0 h-full overflow-y-auto">
        <div key={activeNav} className="tj-tab-fade h-full">
          {activeNav === 'academic' && (
            <div className="h-full px-8 py-6">
              <AcademicNoticesPCContent />
            </div>
          )}
          {activeNav === 'notices' && (
            <div className="h-full px-8 py-6 max-w-[720px] mx-auto">
              <NoticesPage embedded onBack={noop} />
            </div>
          )}
          {activeNav === 'settings' && (
            <div className="h-full px-8 py-6">
              <SettingsPage embedded onBack={noop} onOpenAppInfo={() => setActiveNav('app-info')} />
            </div>
          )}
          {activeNav === 'app-info' && (
            <div className="h-full px-8 py-6 max-w-[720px] mx-auto">
              <AppInfoPage embedded onBack={noop} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
