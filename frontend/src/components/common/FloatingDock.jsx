import { useRef, useState } from 'react'
import { Home, Clock, Building2, Megaphone, MoreHorizontal } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import usePathname from '../../hooks/usePathname'
import DockQuickAccess from './DockQuickAccess'

// 독이 화면 하단에서 실제로 가리는 높이(결함 #7 · #8). bottom-[14px] 오프셋 +
// 자체 높이(상하 padding 18px + 아이콘 22px + gap 4px + 라벨 12px ≈ 56px) + 여유 =
// 76px(safe-area는 별도로 env()로 더한다). MainShell(콘텐츠 하단 패딩)과
// ui/Sheet(바텀시트 하단 패딩)가 이 값을 그대로 가져다 쓴다 — 독 높이가 바뀌면
// 여기 한 곳만 고치면 된다.
export const DOCK_RESERVED_PX = 76

// 모바일 floating dock. 아이콘 + 12px 라벨(아이콘 아래).
// 활성 = accent, 비활성 = white/60.
// 위치: bottom 14px / left 14px / right 14px. radius 22px.
// 5탭: 홈/시간표/학교시설/공지/더보기.
// 예전엔 학식·매장이 같은 /facilities 페이지의 서로 다른 탭인데도 독 칸을 두 개
// 나눠 썼다(사용자 요구: "홈 시간표 학식/매장 공지 더보기 이렇게 5개로 개편해" →
// 검토 결과 학식과 매장을 한 칸으로 합치는 쪽으로 정리). 합친 탭 라벨은
// "학식/매장"이 아니라 "학교시설"을 쓴다 — 이 페이지는 학식·매장 외에 도서관
// 탭도 갖고 있어 "학식/매장"이라 부르면 도서관이 라벨 밖으로 빠지고, PC
// 사이드바(pcNavTabs.js PC_TABS)와 페이지 제목(PageHeader)이 이미 "학교시설"을
// 쓰고 있어 같은 화면을 독만 다른 이름으로 부르는 일을 피할 수 있다. 진입 탭은
// FacilitiesPage의 기본 탭(매장)을 그대로 따르도록 쿼리 없이 /facilities로 연다.
// 더보기는 독으로 되돌아왔다 — 예전엔 히어로 상단 아이콘 줄로 옮겼었지만, 학식·
// 매장이 합쳐지며 독에 빈 칸이 생겨 그 자리를 다시 채운다(히어로 쪽 중복 버튼은
// 뺐다 — HomeWeatherHero.jsx 참고).
// 홈 탭 롱프레스(500ms) → 즐겨찾기 팝오버(기존 동작 유지).
// 결함 #31: 라벨 없이 아이콘만으로는 초행 사용자가 탭 의미를 알기 어려웠다
// — 아이콘 아래 12px 라벨을 추가하되 터치 타깃(44px)은 그대로 유지한다.

const TABS = [
  { id: 'home',        Icon: Home,          href: '/',           label: '홈'     },
  { id: 'schedule',    Icon: Clock,         href: '/schedule',   label: '시간표' },
  { id: 'facilities',  Icon: Building2,     href: '/facilities', label: '학교시설' },
  { id: 'notices',     Icon: Megaphone,     href: '/notices',    label: '공지'   },
  { id: 'more',        Icon: MoreHorizontal, href: '/more',      label: '더보기' },
]

/**
 * pathname으로 활성 탭을 가른다. 학식/매장/도서관은 모두 같은 /facilities
 * 페이지의 하위 탭이라(?tab=으로만 구분) 독에서는 더 이상 서로 다른 탭으로
 * 나누지 않는다 — /facilities 경로 전체가 "학교시설" 한 탭이라, 쿼리를 볼
 * 필요가 없어졌다(예전엔 학식/매장을 가르려고 search까지 함께 추적했다).
 *
 * 결함 #12 — 매칭 실패 시 무조건 'home'을 반환하던 폴백을 제거했다. /more가
 * 이제 독의 다섯 번째 탭이 됐으므로 그 경로는 명시적으로 'more'를 반환하고,
 * 그 외 다섯 탭 어디에도 속하지 않는 화면(/favorites, /settings 등)은
 * 여전히 아무 탭도 활성이 아니다. 홈은 실제 홈 경로(정확히 '/')일 때만 활성이다.
 */
function getActiveId(pathname) {
  if (pathname.startsWith('/schedule')) return 'schedule'
  if (pathname.startsWith('/notices'))  return 'notices'
  if (pathname.startsWith('/more'))     return 'more'
  // /facilities(학식·매장·도서관 서브탭 전부)와 그 옛 주소 /cafeteria(탭
  // 페이지·상세 페이지 모두, 북마크·위젯 딥링크)는 전부 학교시설 한 탭이다.
  if (pathname.startsWith('/facilities') || pathname.startsWith('/cafeteria')) {
    return 'facilities'
  }
  if (pathname === '/') return 'home'
  return null
}

export default function FloatingDock() {
  const pathname = usePathname()
  const activeId = getActiveId(pathname)
  const [longPressActive, setLongPressActive] = useState(false)
  const longPressTimerRef = useRef(null)
  const longPressTriggeredRef = useRef(false)

  const handleNav = (e, href) => {
    e.preventDefault()
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false
      return
    }
    // 결함 #2 — MainShell은 mapExpanded일 때 Dashboard/Hero를 통째로 숨기고
    // MapView만 그린다(currentPage/homeView와 무관). 지도를 편 채로 독을 눌러
    // 다른 탭으로 가도(심지어 "홈"을 다시 눌러도) mapExpanded가 그대로 남아있으면
    // 화면은 지도에 그대로 갇힌다. 독은 이 앱에서 pushState로 라우팅을 바꾸는
    // 유일한 진입점이라 여기서 한 번만 풀어준다 — MainShell의 effect나 App의
    // 라우팅 쪽에서 또 풀면 책임이 두 곳으로 갈린다.
    useAppStore.getState().setMapExpanded(false)
    // 결함(사용자 실측) — 히어로 위 "지금/시간표" 셀렉터를 없애고 독의 홈/시간표
    // 탭이 그 자리를 대신하게 됐다. 시간표 탭으로 한 번 들어가면 homeView가
    // 'timetable'로 남는데, 셀렉터가 없으니 'now'로 되돌릴 길이 이 탭 말고는
    // 없다 — mapExpanded와 같은 이유로 독이 라우팅을 바꾸는 유일한 지점이라
    // 여기서 홈 탭을 누를 때만 되돌린다.
    if (href === '/') {
      useAppStore.getState().setHomeView('now')
    }
    // 예전엔 href가 쿼리를 포함할 수 있어(예: /facilities?tab=diet) pathname만
    // 비교하면 늘 다르다고 나와 매번 새 히스토리 항목이 쌓였다. 이제 다섯 탭 href가
    // 전부 쿼리 없는 순수 경로라 pathname만 비교해도 된다 — PCSidebar의
    // navigateToPcTab과 같은 판정이라, 예를 들어 /facilities?tab=diet에서
    // "학교시설" 탭을 다시 눌러도 보고 있던 서브탭이 쿼리째 날아가지 않는다.
    if (window.location.pathname !== href) {
      window.history.pushState({}, '', href)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }

  const startLongPress = () => {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      setLongPressActive(true)
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
    }, 500)
  }

  const endLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  const handleCloseDockQuickAccess = () => {
    setLongPressActive(false)
    longPressTriggeredRef.current = false
  }

  return (
    <nav
      role="navigation"
      aria-label="하단 탭 메뉴"
      // shadow-dock(레거시, "모바일 floating dock" 전용값)을 DESIGN.md §4의
      // sh-card/sh-lift/sh-pop 체계로 옮긴다. 콘텐츠 위에 항상 떠 있는 하단 독은
      // hover 없이도 늘 "들려" 보여야 하는 요소라 sh-lift(2단 중 강한 쪽)가 맞다.
      className="fixed left-[14px] right-[14px] bottom-[14px] z-nav flex justify-around items-center py-[9px] rounded-sheet shadow-sh-lift"
      style={{
        background: 'var(--tj-dock-bg)',
        marginBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ id, Icon, href, label }) => {
        const active = activeId === id
        const isHomeTab = id === 'home'
        return (
          <a
            key={id}
            href={href}
            onClick={(e) => handleNav(e, href)}
            onPointerDown={isHomeTab ? startLongPress : undefined}
            onPointerUp={isHomeTab ? endLongPress : undefined}
            onPointerLeave={isHomeTab ? endLongPress : undefined}
            onPointerCancel={isHomeTab ? endLongPress : undefined}
            onContextMenu={(e) => {
              if (isHomeTab) e.preventDefault()
            }}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            style={isHomeTab ? { touchAction: 'none' } : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] pressable transition-colors duration-snap ease-out ${
              active ? 'text-accent' : 'text-white/60'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.9} aria-hidden="true" />
            <span className="text-meta leading-none font-semibold">{label}</span>
          </a>
        )
      })}
      {longPressActive && <DockQuickAccess onClose={handleCloseDockQuickAccess} />}
    </nav>
  )
}
