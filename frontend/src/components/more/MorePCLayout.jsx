/**
 * MorePCLayout — 더보기(More) 탭의 PC 전폭 콘텐츠.
 *
 * 좌측 rail(nav 4항목 + 개인정보처리방침 + 다가오는 일정)은 PCSidebar의
 * 컨텍스트 서브내비(학사공지/앱 공지) + 설정 섹션(설정/앱 정보/개인정보처리
 * 방침)으로 이관됐다 — 더보기 페이지 자체는 더 이상 좌측 rail을 갖지 않고
 * activeNav에 대응하는 콘텐츠 하나만 전폭으로 렌더한다.
 *
 * activeNav의 단일 출처는 useAppStore.pcMoreNav다. PCSidebar와 이 컴포넌트가
 * App.jsx상 형제 트리라 URL 없이 뷰를 동기화할 지점이 store뿐이기 때문
 * (mistakes.md 4 — 숨김 대신 조건부 렌더, 여기서는 상태 공유 지점 문제).
 * 다만 이 컴포넌트를 rail 없이 단독 렌더(테스트 등)할 때도 기존처럼 동작해야
 * 하므로, store 필드가 없으면(테스트에서 모킹 안 한 경우) initialNav 기반
 * 로컬 상태로 자연히 폴백한다 — 두 출처를 `pcMoreNav ?? localNav`로 합친다.
 *
 * 렌더링하는 4개 컴포넌트(AcademicNoticesPCContent/NoticesPage/
 * SettingsPage/AppInfoPage)는 전부 기존 파일 그대로 재사용하고, "다가오는
 * 일정" 표시 로직(D-day/날짜 포맷)도 utils/academicCalendar.js 헬퍼를 그대로
 * import해 쓴다 — 인라인 재계산/복제 금지(mistakes.md 2).
 */
import { useLayoutEffect, useState } from 'react'
import useAppStore from '../../stores/useAppStore'
import { useAcademicCalendar } from '../../hooks/useMore'
import { formatDday, formatDateOrRange } from '../../utils/academicCalendar'
import AcademicNoticesPCContent from './AcademicNoticesPCContent'
import NoticesPage from './NoticesPage'
import SettingsPage from './SettingsPage'
import AppInfoPage from './AppInfoPage'

const NAV_LABEL = {
  academic: '학사공지',
  notices: '앱 공지',
  settings: '설정',
  'app-info': '앱 정보',
}

// 다가오는 일정에서 보여줄 최대 개수(가장 임박한 일정 next 1개 + upcoming).
const UPCOMING_MAX = 4

// embedded 서브페이지의 onBack은 사이드바 컨텍스트 서브내비 전환으로 대체되므로
// 실질적으로 호출될 일이 없다(embedded=true면 자체 헤더/뒤로가기 버튼을 렌더링
// 하지 않음). 그래도 필수 prop 계약은 지켜야 해서 no-op을 명시적으로 넘긴다.
function noop() {}

export default function MorePCLayout({ initialNav = 'academic' }) {
  // store가 단일 출처. 다만 이 컴포넌트를 store 없이(또는 store에 pcMoreNav가
  // 없는 테스트 환경에서) 단독 렌더할 수도 있어 로컬 상태를 폴백으로 둔다.
  const pcMoreNav = useAppStore((s) => s.pcMoreNav)
  const setPcMoreNav = useAppStore((s) => s.setPcMoreNav)
  const [localNav, setLocalNav] = useState(initialNav)

  // 마운트 시(딥링크로 진입 시 포함) initialNav를 store에 반영해, 사이드바도
  // 같은 값을 즉시 반영하게 한다. paint 전에 반영해 깜빡임을 없앤다.
  useLayoutEffect(() => {
    setPcMoreNav?.(initialNav)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만
  }, [])

  const activeNav = pcMoreNav ?? localNav

  function selectNav(id) {
    setLocalNav(id)
    setPcMoreNav?.(id)
  }

  // AcademicNoticesPCContent도 동일 엔드포인트(/school/calendar)를 구독하지만
  // useApi가 URL 기준으로 in-flight dedup + TTL 캐시를 하므로 중복 네트워크
  // 호출이 발생하지 않는다(mistakes.md — 캐시 정합).
  const { data: calendarData } = useAcademicCalendar()
  const next = calendarData?.next ?? null
  const upcoming = Array.isArray(calendarData?.upcoming) ? calendarData.upcoming : []
  const scheduleItems = [next, ...upcoming].filter(Boolean).slice(0, UPCOMING_MAX)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 상단 컨텍스트 헤더 — 현재 섹션 제목 + (학사공지 한정) 다가오는 일정 스트립.
          예전 좌측 rail이 갖던 정보를 잃지 않도록 가로 스트립으로 옮긴다. */}
      <div className="flex-shrink-0 border-b border-line dark:border-line px-8 py-5">
        <h1 className="text-page-ttl text-ink dark:text-white">{NAV_LABEL[activeNav]}</h1>

        {activeNav === 'academic' && scheduleItems.length > 0 && (
          <div className="mt-4">
            <div
              className="text-label font-semibold text-mute dark:text-mute uppercase tracking-widest mb-2"
              style={{ letterSpacing: '0.14em' }}
            >
              다가오는 일정
            </div>
            <div className="flex flex-wrap gap-2">
              {scheduleItems.map((item, i) => {
                const isNext = i === 0
                return (
                  <div
                    key={`${item.title}-${item.start_date}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-mini bg-surface-2 dark:bg-surface-2"
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
                    <span className="text-caption font-semibold text-ink dark:text-ink truncate max-w-[160px]">
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
      </div>

      {/* 전폭 콘텐츠 — 사이드바가 nav를 담당하므로 이 컴포넌트는 콘텐츠만 그린다.
          selectNav를 SettingsPage에 넘겨 "앱 정보 · 오픈소스" 행 클릭 시 여기서도
          섹션 전환이 가능하게 유지한다(기존 onOpenAppInfo 동작 보존). */}
      <div className="flex-1 min-w-0 overflow-y-auto">
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
              <SettingsPage embedded onBack={noop} onOpenAppInfo={() => selectNav('app-info')} />
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
