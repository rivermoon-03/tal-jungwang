/**
 * MorePCLayout — 더보기(More) 탭의 PC 전폭 콘텐츠.
 *
 * 공지(학사공지·앱 공지)는 공지 탭으로 나갔고, 여기 남은 것은 설정·도움말·
 * 앱 정보 세 가지다. nav는 PCSidebar 하단 설정 섹션이 담당하고 이 컴포넌트는
 * activeNav에 대응하는 콘텐츠 하나만 전폭으로 렌더한다.
 *
 * activeNav의 단일 출처는 useAppStore.pcMoreNav다. PCSidebar와 이 컴포넌트가
 * App.jsx상 형제 트리라 URL 없이 뷰를 동기화할 지점이 store뿐이기 때문
 * (mistakes.md 4 — 숨김 대신 조건부 렌더, 여기서는 상태 공유 지점 문제).
 * 다만 이 컴포넌트를 rail 없이 단독 렌더(테스트 등)할 때도 기존처럼 동작해야
 * 하므로, store 필드가 없으면(테스트에서 모킹 안 한 경우) initialNav 기반
 * 로컬 상태로 자연히 폴백한다 — 두 출처를 `pcMoreNav ?? localNav`로 합친다.
 *
 */
import { useLayoutEffect, useState } from 'react'
import useAppStore from '../../stores/useAppStore'
import SettingsPage from './SettingsPage'
import AppInfoPage from './AppInfoPage'
import HelpPage from './HelpPage'

const NAV_LABEL = {
  settings: '설정',
  'app-info': '앱 정보',
  help: '도움말',
}

// embedded 서브페이지의 onBack은 사이드바 컨텍스트 서브내비 전환으로 대체되므로
// 실질적으로 호출될 일이 없다(embedded=true면 자체 헤더/뒤로가기 버튼을 렌더링
// 하지 않음). 그래도 필수 prop 계약은 지켜야 해서 no-op을 명시적으로 넘긴다.
function noop() {}

export default function MorePCLayout({ initialNav = 'settings' }) {
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 상단 컨텍스트 헤더 — 현재 섹션 제목 */}
      <div className="flex-shrink-0 border-b border-line dark:border-line px-8 py-5">
        <h1 className="text-page-ttl text-ink dark:text-white">{NAV_LABEL[activeNav]}</h1>

      </div>

      {/* 전폭 콘텐츠 — 사이드바가 nav를 담당하므로 이 컴포넌트는 콘텐츠만 그린다.
          selectNav를 SettingsPage에 넘겨 "앱 정보 · 오픈소스" 행 클릭 시 여기서도
          섹션 전환이 가능하게 유지한다(기존 onOpenAppInfo 동작 보존). */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div key={activeNav} className="tj-tab-fade h-full">
          {/* 본문은 좌측 기준선을 페이지 제목과 맞춘다. mx-auto로 가운데 정렬하면
              제목만 왼쪽에 남아 축이 어긋나 보였다. 최대 폭만 제한한다. */}
          {activeNav === 'settings' && (
            <div className="h-full px-8 py-6">
              <SettingsPage embedded onBack={noop} onOpenAppInfo={() => selectNav('app-info')} />
            </div>
          )}
          {activeNav === 'help' && (
            <div className="h-full px-8 py-6 max-w-[720px]">
              <HelpPage embedded onBack={noop} />
            </div>
          )}
          {activeNav === 'app-info' && (
            <div className="h-full px-8 py-6 max-w-[560px]">
              <AppInfoPage embedded onBack={noop} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
