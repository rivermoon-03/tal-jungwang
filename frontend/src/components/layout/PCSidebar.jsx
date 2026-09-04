import { useRef, useState } from 'react'
import { Bell, Settings as SettingsIcon, Sun, Moon, Bus, Train, Info, Shield, HelpCircle } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import usePathname from '../../hooks/usePathname'
import { useNotices } from '../../hooks/useMore'
import { useWeather } from '../../hooks/useWeather'
import { SKY_ICON, SKY_TEXT } from '../stats/skyDisplay'
import { describeJeongwangWind } from '../../utils/jeongwangWind'
import { PC_TABS, getActivePcTabId, navigateToPcTab } from '../common/pcNavTabs'
import { parseFavCode } from '../../utils/favCode'
import NoticesPopover from '../common/NoticesPopover'
import IconButton from '../ui/IconButton'

// "값 없음"으로 취급하는 미세먼지 등급 표기 — 백엔드가 측정 실패 시 null이
// 아니라 이 문자열 그대로를 내려줄 때가 있다(결함 #10: "미세먼지 알수없음"
// 원문 노출). 값이 없으면 항목 자체를 숨긴다(빈 라벨을 보여주는 대신).
const PM10_UNKNOWN = '알수없음'

/**
 * PCWeatherStrip — 사이드바 전용 한 줄 날씨 스트립.
 *
 * components/dashboard/PCWeatherSummary(글귀+큰 온도+메타 3단 카드)를 그대로
 * 사이드바에 넣으면 중복 날씨 카드처럼 보이고 세로 공간도 많이 차지한다
 * (결함 #10). dashboard/ 소유 파일은 건드릴 수 없어(파일 소유권), 같은
 * useWeather 훅과 표시 헬퍼(SKY_ICON/SKY_TEXT/describeJeongwangWind)만
 * 재사용해 사이드바 쪽에 훨씬 가벼운 한 줄 표기를 새로 둔다.
 */
function PCWeatherStrip() {
  const { weather } = useWeather()
  if (!weather) {
    return <div className="h-4 w-3/4 rounded-button tj-skeleton" aria-hidden="true" />
  }

  const icon = weather.icon ?? 'sunny'
  const Icon = SKY_ICON[icon] ?? Sun
  const wind = describeJeongwangWind(weather.windSpeed ?? null)
  const hasDust = weather.pm10Grade != null && weather.pm10Grade !== PM10_UNKNOWN

  return (
    <div className="flex items-center gap-1.5 text-caption font-semibold text-ink-2 dark:text-mute">
      <Icon size={16} className="flex-none text-ink-2 dark:text-mute" aria-hidden="true" />
      <span className="tabular-nums text-ink dark:text-ink font-bold flex-none">
        {weather.currentTemp != null ? `${weather.currentTemp}°` : '--'}
      </span>
      <span className="truncate">{SKY_TEXT[icon] ?? ''}</span>
      {wind && <span className="truncate">· 바람 {wind.value}</span>}
      {hasDust && <span className="truncate">· 미세먼지 {weather.pm10Grade}</span>}
    </div>
  )
}

// 컨텍스트 서브내비 — 현재 활성 상위 탭에 딸린 콘텐츠성 하위 항목만 둔다.
// 설정성 항목(설정/앱 정보/개인정보처리방침)은 하단 "설정" 섹션이 전담한다.
const FACILITIES_SUBNAV = [
  { id: 'diet', label: '학식' },
  { id: 'venues', label: '매장' },
  { id: 'library', label: '도서관' },
]
const NOTICES_SUBNAV = [
  { id: 'academic', label: '학사공지' },
  { id: 'app', label: '앱 공지' },
]
// 홈(지도) 탭은 서브내비를 두지 않는다. 예전엔 "지금"/"시간표" 두 항목을
// MAP_SUBNAV로 여기 두었는데, 그러면 홈이 활성일 때 홈 자신과 그 아래
// "지금" 항목이 동시에 강조돼 두 줄이 같이 칠해졌다(계층이 홈의 하위인지
// 별개 탭인지 읽히지 않았다) — 지금/시간표 전환은 PCMainShell이 지도 패널
// 상단에 그리는 세그먼트 컨트롤로 옮겼다(PCMainShell.jsx MAP_VIEWS 참고).

/**
 * PCSidebar — 데스크톱 전용 좌측 반투명 사이드바(폭 약 236px).
 *
 * pc-mockup.html의 .sidebar(반투명 A) 구성을 그대로 옮긴다: 브랜드 → 날씨 한 줄
 * 스트립(PCWeatherStrip, 결함 #10 — 중복되던 큰 날씨 카드를 압축) → 4탭 네비(PCDock과 동일한 pcNavTabs 공유) →
 * 컨텍스트 서브내비(활성 탭이 학식/공지일 때만, macOS Finder식) →
 * 즐겨찾기 요약(useAppStore.favorites) → 설정 진입 3항목 → footer(다크모드
 * 토글 + 공지 벨 — 이전에 PCDock이 갖던 기능을 이관).
 *
 * 홈(map) 탭은 서브내비를 두지 않는다 — 지금/시간표 전환은 이 사이드바가
 * 아니라 PCMainShell의 지도 패널 상단 세그먼트로 옮겼다(PCMainShell.jsx
 * MAP_VIEWS 참고). 학식/공지 콘텐츠와는 App.jsx상 형제 컴포넌트라 URL 없이
 * 뷰를 동기화할 곳이 store뿐이다 — pcCafeteriaTab/pcNoticesTab(useAppStore,
 * persist 제외)를 공유 출처로 쓰고, CafeteriaPCLayout/MorePCLayout이 동일
 * 필드를 구독한다.
 */
export default function PCSidebar() {
  const pathname = usePathname()
  const activeId = getActivePcTabId(pathname)

  const darkMode = useAppStore((s) => s.darkMode)
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode)
  const favorites = useAppStore((s) => s.favorites)
  const favoriteRoutes = favorites?.routes ?? []
  const setDetailModal = useAppStore((s) => s.setDetailModal)

  const pcCafeteriaTab = useAppStore((s) => s.pcCafeteriaTab)
  const setPcCafeteriaTab = useAppStore((s) => s.setPcCafeteriaTab)
  const setPcMoreNav = useAppStore((s) => s.setPcMoreNav)
  const pcNoticesTab = useAppStore((s) => s.pcNoticesTab)
  const setPcNoticesTab = useAppStore((s) => s.setPcNoticesTab)

  const { data: notices } = useNotices()
  const hasNotices = Array.isArray(notices) && notices.length > 0
  const [noticesOpen, setNoticesOpen] = useState(false)
  const bellRef = useRef(null)

  // 즐겨찾기 항목을 누르면 그 노선의 상세 시트를 연다.
  // 예전에는 모든 행이 goSettings 에 묶여 있어서 무엇을 눌러도 /more 로 갔다 —
  // hover 상태는 정상이라 눌리는 것처럼 보이기만 했다.
  // 모바일 팝오버(DockQuickAccess)와 같은 parseFavCode + setDetailModal 경로를 쓴다.
  const openFavorite = (favCode) => () => {
    const item = parseFavCode(favCode)
    if (!item) return
    const { type, routeCode, title, ...rest } = item
    setDetailModal({ type, routeCode, title, ...rest })
  }

  // 컨텍스트 서브내비 클릭 — store를 먼저 갱신해 콘텐츠가 즉시 반응하게 하고,
  // 현재 경로가 상위 탭 루트가 아니면(예: 식당 상세 페이지) 그리로 되돌린다.
  // 서브탭도 주소에 남긴다(?tab= / ?nav=). 뷰의 출처는 여전히 store지만, 주소가
  // 화면을 설명하지 못하면 새로고침이나 링크 공유에서 다른 화면이 열린다.
  const selectCafeteriaTab = (id) => (e) => {
    e.preventDefault()
    setPcCafeteriaTab(id)
    const url = `/facilities?tab=${id}`
    if (window.location.pathname !== '/facilities') {
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } else {
      window.history.replaceState({}, '', url)
    }
  }
  const selectNoticesTab = (id) => (e) => {
    e.preventDefault()
    setPcNoticesTab(id)
    const url = id === 'academic' ? '/notices' : `/notices?tab=${id}`
    if (window.location.pathname !== '/notices') {
      window.history.pushState({}, '', url)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } else {
      window.history.replaceState({}, '', url)
    }
  }
  // 설정 섹션 항목 — 안정 URL(/more/settings, /more/app-info, /privacy)로
  // pushState하면서 더보기 PC 레이아웃의 nav도 함께 맞춰둔다(있는 경우에만).
  const goMoreSub = (path, nav) => (e) => {
    if (nav) setPcMoreNav(nav)
    navigateToPcTab(e, path)
  }

  return (
    <aside
      aria-label="사이드바"
      className="flex h-full w-[236px] flex-none flex-col gap-1 overflow-y-auto border-r border-line bg-surface-2/85 px-3 py-4 backdrop-blur-xl backdrop-saturate-150 dark:bg-surface/85"
    >
      {/* 브랜드 */}
      <div className="mb-1 flex items-center gap-2.5 px-2 pb-2">
        <div
          aria-hidden="true"
          // 34px는 4px 그리드 밖(8.5칸)이다. w-9/h-9(36px)는 이 코드베이스 전역에서
          // 아이콘 배지 박스로 반복되는 값이라(MapLegendOnboarding, SearchOverlay,
          // PCMapDockPanel 등) 그 관행에 맞춰 36px로 스냅한다 — 32px보다 시각 차이가 적다.
          // shadow-pill(레거시)은 DESIGN.md §4의 sh-card/sh-lift/sh-pop 2~3단계
          // 밖이다. 로고 배지는 늘 제자리에 떠 있는 정적 요소라 팝오버용 sh-pop이나
          // hover로 들리는 sh-lift보다 은은한 sh-card가 맞다.
          className="grid h-9 w-9 flex-none place-items-center rounded-badge bg-gradient-to-br from-accent to-accent-hover text-white shadow-sh-card"
        >
          <Bus size={17} strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-caption font-extrabold tracking-[-0.02em] text-ink">탈것:정왕</p>
          <p className="truncate text-dest font-semibold text-mute">정왕 교통 · 실시간</p>
        </div>
      </div>

      {/* 날씨 한 줄 스트립 — 예전엔 사이드바에도 홈과 같은 큰 날씨 카드가
          그대로 들어가 중복돼 보였다(결함 #10). 사이드바에서는 요약 한 줄로 충분하다. */}
      <div className="mb-2 rounded-card border border-line bg-surface px-3 py-2.5">
        <PCWeatherStrip />
      </div>

      {/* 4탭 네비 + 컨텍스트 서브내비.
          서브내비는 해당 상위 탭 바로 아래에 렌더한다. 예전에는 4탭을 모두 그린 뒤
          별도 nav로 이어 붙여, 학식 하위 메뉴인데도 마지막 항목인 "더보기"에 딸린
          것처럼 보였다. */}
      <nav className="flex flex-col gap-0.5" aria-label="주요 메뉴">
        {PC_TABS.map(({ id, Icon, href, label }) => {
          const active = activeId === id
          // 홈(map)은 서브내비가 없다 — 지금/시간표 전환은 PCMainShell의
          // 지도 패널 상단 세그먼트로 옮겼다(위 주석 참고).
          const subnav =
            id === 'facilities' ? FACILITIES_SUBNAV
            : id === 'notices' ? NOTICES_SUBNAV
            : null
          const activeSubId =
            id === 'facilities' ? pcCafeteriaTab
            : id === 'notices' ? pcNoticesTab
            : null
          const onSelectSub =
            id === 'facilities' ? selectCafeteriaTab
            : selectNoticesTab

          return (
            <div key={id} className="flex flex-col gap-0.5">
              <a
                href={href}
                onClick={(e) => navigateToPcTab(e, href)}
                aria-current={active ? 'page' : undefined}
                className={`pressable flex items-center gap-3 rounded-button px-3 py-2 text-caption font-semibold transition-colors duration-snap ease-out ${
                  active ? 'bg-accent-bg text-accent-ink' : 'text-ink-2 hover:bg-ink/[0.06]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" className={active ? 'text-accent' : 'text-mute'} />
                {label}
              </a>

              {active && subnav && (
                <div className="flex flex-col gap-0.5" role="group" aria-label={`${label} 하위 메뉴`}>
                  {subnav.map((sub) => {
                    const subActive = activeSubId === sub.id
                    return (
                      <a
                        key={sub.id}
                        // 하위 메뉴도 각자 고유 URL을 갖는다. 예전에는 둘 다 상위와
                        // 같은 경로여서 새 탭으로 열거나 북마크하면 어느 쪽인지
                        // 구분되지 않았다.
                        href={`${href}?tab=${sub.id}`}
                        onClick={onSelectSub(sub.id)}
                        aria-current={subActive ? 'page' : undefined}
                        className={`pressable flex items-center rounded-button py-2 pl-10 pr-3 text-caption font-semibold transition-colors duration-snap ease-out ${
                          subActive ? 'bg-accent-bg text-accent-ink' : 'text-ink-2 hover:bg-ink/[0.06]'
                        }`}
                      >
                        {sub.label}
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 즐겨찾기 */}
      {favoriteRoutes.length > 0 && (
        <div className="mt-3">
          <p className="px-3 pb-1 text-dest font-bold uppercase tracking-[.07em] text-mute">즐겨찾기</p>
          <ul className="flex flex-col gap-0.5">
            {favoriteRoutes.map((routeKey) => {
              const isSubway = routeKey.startsWith('subway:')
              const label = isSubway ? routeKey.replace('subway:', '').replace(':', ' ') : routeKey
              return (
                <li key={routeKey}>
                  <button
                    type="button"
                    onClick={openFavorite(routeKey)}
                    // 22px는 4px 그리드 밖이라 20px(pl-5)로 스냅한다. 20과 24 둘 다
                    // 등거리라 상단 네비 아이콘 들여쓰기(px-3=12px)에 더 가까운 쪽을
                    // 골라 즐겨찾기 목록이 상위 네비의 연장처럼 보이게 한다.
                    className="pressable flex min-h-[44px] w-full items-center gap-3 rounded-button py-2 pl-5 pr-3 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
                  >
                    {isSubway
                      ? <Train size={15} className="flex-none text-mute" aria-hidden="true" />
                      : <Bus size={15} className="flex-none text-mute" aria-hidden="true" />}
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 설정 — 알림/화면 설정 + 앱 정보 + 개인정보처리방침 (더보기의 설정 서브페이지로 라우팅) */}
      <div className="mt-3">
        <p className="px-3 pb-1 text-dest font-bold uppercase tracking-[.07em] text-mute">설정</p>
        <a
          href="/more/settings"
          onClick={goMoreSub('/more/settings', 'settings')}
          className="pressable flex items-center gap-3 rounded-button px-3 py-2 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
        >
          <SettingsIcon size={18} className="text-mute" aria-hidden="true" />
          설정
        </a>
        <a
          href="/more/app-info"
          onClick={goMoreSub('/more/app-info', 'app-info')}
          className="pressable flex items-center gap-3 rounded-button px-3 py-2 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
        >
          <Info size={18} className="text-mute" aria-hidden="true" />
          앱 정보
        </a>
        <a
          href="/more/help"
          onClick={goMoreSub('/more/help', 'help')}
          className="pressable flex items-center gap-3 rounded-button px-3 py-2 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
        >
          <HelpCircle size={18} className="text-mute" aria-hidden="true" />
          도움말
        </a>
        <a
          href="/privacy"
          onClick={goMoreSub('/privacy', null)}
          className="pressable flex items-center gap-3 rounded-button px-3 py-2 text-caption font-semibold text-ink-2 hover:bg-ink/[0.06]"
        >
          <Shield size={18} className="text-mute" aria-hidden="true" />
          개인정보처리방침
        </a>
      </div>

      <div className="flex-1" />

      {/* footer — 다크모드 토글 + 공지 벨 (구 PCDock에서 이관, PCDock 자체는
          죽은 코드라 2026-09에 삭제). 36px(h-9 w-9)이던 히트 영역을
          IconButton(44px)으로 맞춘다. */}
      <div className="mt-2 flex items-center gap-2 border-t border-line px-1 pt-3">
        <IconButton
          title={darkMode ? '라이트 모드로' : '다크 모드로'}
          label={darkMode ? '라이트 모드로' : '다크 모드로'}
          onClick={toggleDarkMode}
          variant="floating"
        >
          {darkMode ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </IconButton>
        <IconButton
          ref={bellRef}
          title="공지사항"
          label="공지사항"
          aria-haspopup="dialog"
          aria-expanded={noticesOpen}
          onClick={() => setNoticesOpen((v) => !v)}
          className={`relative shadow-sh-card ${
            noticesOpen ? '!bg-ink !text-white' : '!bg-accent !text-white hover:!opacity-90'
          }`}
        >
          <Bell size={17} aria-hidden="true" />
          {hasNotices && !noticesOpen && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-pill bg-imminent border border-surface-2"
            />
          )}
        </IconButton>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-caption font-semibold text-ink-2">한국공학대</p>
          <p className="truncate text-dest font-semibold text-mute">TIP · 정왕</p>
        </div>
      </div>
      <NoticesPopover open={noticesOpen} onClose={() => setNoticesOpen(false)} anchorRef={bellRef} />
    </aside>
  )
}
