import { useEffect, useRef, useState } from 'react'
import { Home, Clock, UtensilsCrossed, Store, Megaphone } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
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
// 5탭: 홈/시간표/학식/매장/공지.
// 시간표·학식은 학생이 가장 자주 여는 두 화면인데 한 단계 안쪽(홈 뷰 전환, 학교시설
// 서브탭)에 묻혀 있었다 — 각각 1탭씩으로 끌어올린다. 그 대신 더보기는 독에서 뺀다
// (도달 경로는 HomeWeatherHero.jsx의 "히어로 옵션" 아이콘 그룹으로 옮김 — 그쪽
// goToMore 주석 참고).
// 홈 탭 롱프레스(500ms) → 즐겨찾기 팝오버(기존 동작 유지).
// 결함 #31: 라벨 없이 아이콘만으로는 초행 사용자가 탭 의미를 알기 어려웠다
// — 아이콘 아래 12px 라벨을 추가하되 터치 타깃(44px)은 그대로 유지한다.

const TABS = [
  { id: 'home',     Icon: Home,            href: '/',                       label: '홈'   },
  { id: 'schedule', Icon: Clock,           href: '/schedule',               label: '시간표' },
  { id: 'diet',     Icon: UtensilsCrossed, href: '/facilities?tab=diet',    label: '학식' },
  { id: 'venues',   Icon: Store,           href: '/facilities?tab=venues',  label: '매장' },
  { id: 'notices',  Icon: Megaphone,       href: '/notices',                label: '공지' },
]

/**
 * pathname + search 로 활성 탭을 가른다. 학식/매장은 같은 경로(/facilities)를
 * ?tab= 값으로만 구분하므로 pathname만 보면 두 탭이 동시에 활성으로 보인다
 * (요구사항: "/facilities?tab=venues 에서 매장만 활성이어야지 학식까지 활성이면 안 된다").
 *
 * 결함 #12 — 매칭 실패 시 무조건 'home'을 반환하던 폴백을 제거했다. /more,
 * /favorites, /settings 등 다섯 탭 어디에도 속하지 않는 화면에서도 독이 "홈"을
 * 활성으로 칠하고 aria-current="page"까지 붙여, 사용자가 실제로는 홈이 아닌
 * 화면에서 홈 탭이 눌린 것처럼 보였다. 홈은 실제 홈 경로(정확히 '/')일 때만
 * 활성이고, 그 외 다섯 탭에 안 속하는 경로는 아무 탭도 활성이 아니어야 한다.
 */
function getActiveId(pathname, search) {
  if (pathname.startsWith('/schedule')) return 'schedule'
  if (pathname.startsWith('/notices'))  return 'notices'
  // /cafeteria/:id 는 매장 상세 페이지다 — 매장 탭의 연장으로 본다.
  if (pathname.startsWith('/cafeteria/')) return 'venues'
  // /facilities 와 그 옛 주소 /cafeteria(슬래시 없음, 북마크·위젯 딥링크)는
  // ?tab= 으로만 학식/매장을 가른다. FacilitiesPage의 기본 탭이 매장이라
  // 쿼리가 없을 때도 매장에 맞춘다(페이지 실제 초기 화면과 독의 활성 표시를 맞춤).
  if (pathname.startsWith('/facilities') || pathname === '/cafeteria') {
    return new URLSearchParams(search).get('tab') === 'diet' ? 'diet' : 'venues'
  }
  if (pathname === '/') return 'home'
  return null
}

function currentLocation() {
  if (typeof window === 'undefined') return { pathname: '/', search: '' }
  return { pathname: window.location.pathname, search: window.location.search }
}

export default function FloatingDock() {
  // usePathname은 pathname만 추적해 쿼리만 바뀌는 학식↔매장 전환에는 반응하지
  // 않는다(같은 /facilities라 pathname 값이 그대로다) — pathname+search를 함께
  // 들고 popstate마다 갱신한다.
  const [location, setLocation] = useState(currentLocation)
  useEffect(() => {
    const onChange = () => setLocation(currentLocation())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])

  const activeId = getActiveId(location.pathname, location.search)
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
    // href가 쿼리를 포함할 수 있어(예: /facilities?tab=diet) pathname만으로
    // "이미 그 화면"을 판정하면 늘 다르다고 나와 매번 새 히스토리 항목이 쌓인다.
    const current = window.location.pathname + window.location.search
    if (current !== href) {
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
