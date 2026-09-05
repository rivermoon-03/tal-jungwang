/**
 * NoticesTabPage — /notices 탭.
 *
 * 학사공지(장학·학사·취업·생활관)와 앱 공지가 예전에는 더보기 탭 안에 설정과
 * 섞여 있었다. 장학처럼 마감이 있는 공지의 진입 경로가 "더보기 → 탭 전환"이면
 * 늦게 본다. 탭 하나를 통째로 준다 — 시간표가 홈으로 들어가며 비운 자리다.
 *
 * PC는 사이드바가 서브내비(학사공지/앱 공지)를 그리므로 여기서는 세그먼트를
 * 생략하고 store(pcNoticesTab)를 따른다. 모바일은 SegmentedControl 세그먼트.
 */
import { useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import SegmentedControl from '../components/ui/SegmentedControl'
import AcademicNoticesTab from '../components/more/AcademicNoticesTab'
import AcademicNoticesPCContent from '../components/more/AcademicNoticesPCContent'
import AppNoticesTab from '../components/notices/AppNoticesTab'
import NoticesPage from '../components/more/NoticesPage'
import useAppStore from '../stores/useAppStore'
import { useIsDesktop } from '../hooks/useMediaQuery'

const TOP_TABS = [
  { value: 'academic', label: '학사공지' },
  { value: 'app', label: '앱 공지' },
]

// ?tab=academic|app — 주소가 화면을 설명해야 링크 공유·새로고침이 같은 화면을 연다.
function readTab() {
  if (typeof window === 'undefined') return 'academic'
  const tab = new URLSearchParams(window.location.search).get('tab')
  return tab === 'app' ? 'app' : 'academic'
}

export default function NoticesTabPage() {
  const isDesktop = useIsDesktop()
  const [tab, setTab] = useState(readTab)
  const [listOpen, setListOpen] = useState(false)

  const pcNoticesTab = useAppStore((s) => s.pcNoticesTab)
  const setPcNoticesTab = useAppStore((s) => s.setPcNoticesTab)

  function selectTab(next) {
    setTab(next)
    setPcNoticesTab?.(next)
    window.history.replaceState({}, '', next === 'academic' ? '/notices' : `/notices?tab=${next}`)
  }

  if (isDesktop) {
    const active = pcNoticesTab ?? tab
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-shrink-0 border-b border-line dark:border-line px-8 py-5">
          <h1 className="text-page-ttl text-ink dark:text-white">
            {active === 'app' ? '앱 공지' : '학사공지'}
          </h1>
        </div>
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div key={active} className="tj-tab-fade h-full">
            {active === 'app' ? (
              <div className="h-full px-8 py-6 max-w-[820px]">
                <NoticesPage embedded onBack={() => {}} />
              </div>
            ) : (
              <div className="h-full px-8 py-6">
                <AcademicNoticesPCContent />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (listOpen) return <NoticesPage onBack={() => setListOpen(false)} />

  return (
    <div className="flex flex-col h-full bg-bg dark:bg-bg animate-fade-in-up">
      <PageHeader title="공지" />

      {/* 홈과 시간표가 쓰는 정본 SegmentedControl 을 쓴다. 예전엔 이 탭만
          ui/SegmentTabs 라 활성 배경이 텍스트와 어긋나 잘려 보였다(사용자 리포트).
          아래 여백은 두지 않는다 — 콘텐츠(카테고리 칩)가 탭 바로 아래 온다. */}
      <div className="px-4 pt-1 flex-shrink-0">
        <SegmentedControl options={TOP_TABS} value={tab} onChange={selectTab} ariaLabel="공지 종류 선택" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28 md:pb-6">
        {tab === 'academic' ? (
          <AcademicNoticesTab />
        ) : (
          <AppNoticesTab onOpenNotices={() => setListOpen(true)} />
        )}
      </div>
    </div>
  )
}
