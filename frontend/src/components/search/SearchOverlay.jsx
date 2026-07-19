/**
 * SearchOverlay — 노선·정류장 검색 오버레이 (M-2).
 *
 * useAppStore.searchOpen이 true일 때 App 최상위(라우트 무관)에 전체 화면으로 뜬다.
 * 클라이언트 정적 인덱스(utils/searchIndex)만 사용 — 이 화면 범위에서는 실시간 도착
 * 분 조회를 하지 않는다(결과 행은 라벨만, 상세 진입 후 확인).
 */
import { useEffect, useRef, useState } from 'react'
import { Search, X, Clock, Bus, TrainFront } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { searchEntries, SELECTABLE_SUBWAY_STATIONS } from '../../utils/searchIndex'
import RouteBadge from '../ui/RouteBadge.jsx'

const TYPE_ICON = {
  station: Bus,
  subway: TrainFront,
  shuttle: Bus,
}

// route 타입은 RouteBadge, 그 외 타입은 아이콘 배지.
function ResultIcon({ type }) {
  const Icon = TYPE_ICON[type] ?? Search
  return (
    <span className="flex-shrink-0 w-9 h-9 rounded-full bg-surface-2 dark:bg-surface-2 flex items-center justify-center">
      <Icon size={16} className="text-ink-2 dark:text-mute" aria-hidden="true" />
    </span>
  )
}

function ResultRow({ entry, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className="pressable w-full min-h-[52px] flex items-center gap-3 px-4 py-2.5 rounded-mini hover:bg-surface-2 dark:hover:bg-surface-2 transition-colors text-left"
      style={{ touchAction: 'manipulation' }}
    >
      {entry.type === 'route' ? (
        <span className="flex-shrink-0 w-9 flex items-center justify-center">
          <RouteBadge route={entry.id} size="sm" />
        </span>
      ) : (
        <ResultIcon type={entry.type} />
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-body font-semibold text-ink dark:text-ink truncate">
          {entry.label}
        </span>
        {entry.sub && (
          <span className="block text-caption text-mute dark:text-mute truncate">
            {entry.sub}
          </span>
        )}
      </span>
    </button>
  )
}

function RecentRow({ entry, onSelect, onRemove }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(entry)}
        className="pressable flex-1 min-w-0 min-h-[48px] flex items-center gap-3 px-4 py-2 rounded-mini hover:bg-surface-2 dark:hover:bg-surface-2 transition-colors text-left"
        style={{ touchAction: 'manipulation' }}
      >
        <Clock size={16} className="flex-shrink-0 text-mute dark:text-mute" aria-hidden="true" />
        <span className="flex-1 min-w-0 text-label font-medium text-ink dark:text-ink truncate">
          {entry.label}
        </span>
      </button>
      <button
        type="button"
        onClick={() => onRemove(entry)}
        aria-label={`${entry.label} 최근 검색 삭제`}
        className="pressable flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-mute dark:text-mute hover:bg-surface-2 dark:hover:bg-surface-2 transition-colors"
        style={{ touchAction: 'manipulation' }}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function SearchOverlay() {
  const open = useAppStore((s) => s.searchOpen)
  const setOpen = useAppStore((s) => s.setSearchOpen)
  const recentSearches = useAppStore((s) => s.recentSearches)
  const addRecentSearch = useAppStore((s) => s.addRecentSearch)
  const removeRecentSearch = useAppStore((s) => s.removeRecentSearch)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setSelectedMode = useAppStore((s) => s.setSelectedMode)
  const setBusStation = useAppStore((s) => s.setBusStation)
  const setSubwayStation = useAppStore((s) => s.setSubwayStation)
  const setShuttleCampus = useAppStore((s) => s.setShuttleCampus)

  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  const results = searchEntries(query)

  // 열릴 때: 입력 초기화 + 자동 포커스.
  // (ScheduleDetailModal의 "열릴 때마다 store 값으로 재동기화" effect와 동일 패턴.)
  useEffect(() => {
    if (!open) return
    setQuery('')
    // 오버레이 마운트/트랜지션 직후 포커스되도록 다음 틱으로 미룬다.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  // body 스크롤 잠금 (기존 모달 패턴과 동일).
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC / 뒤로가기(popstate)로 닫힘.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPopState() {
      setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('popstate', onPopState)
    }
  }, [open, setOpen])

  if (!open) return null

  function close() {
    setOpen(false)
  }

  // 페이지 이동 없이 홈(지도) 탭으로 — GlobalDetailModal의 onShowMap과 동일 패턴.
  function goHome() {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/')
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    setActiveTab('map')
  }

  function goToRoute(routeId) {
    const url = `/route/bus:${routeId}`
    window.history.pushState({ routeId }, '', url)
    window.dispatchEvent(new PopStateEvent('popstate', { state: { routeId } }))
  }

  function handleSelect(entry) {
    addRecentSearch({ type: entry.type, id: entry.id, label: entry.label, sub: entry.sub })

    if (entry.type === 'route') {
      goToRoute(entry.id)
    } else if (entry.type === 'station') {
      setSelectedMode('bus')
      setBusStation(entry.id)
      goHome()
    } else if (entry.type === 'subway') {
      setSelectedMode('subway')
      if (SELECTABLE_SUBWAY_STATIONS.includes(entry.id)) setSubwayStation(entry.id)
      goHome()
    } else if (entry.type === 'shuttle') {
      setSelectedMode('shuttle')
      setShuttleCampus(entry.campus)
      goHome()
    }

    close()
  }

  const trimmed = query.trim()

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="노선·정류장 검색"
      className="fixed inset-0 z-[200] bg-bg dark:bg-bg flex flex-col"
    >
      {/* 상단: 검색 입력 + 취소 */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 pb-3"
        style={{ paddingTop: 'max(14px, calc(env(safe-area-inset-top) + 10px))' }}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 rounded-pill border-[1.5px] border-accent bg-surface dark:bg-surface px-4 py-2.5">
          <Search size={16} className="flex-shrink-0 text-mute dark:text-mute" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            aria-label="노선·정류장 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="노선번호, 정류장, 역 검색"
            className="min-w-0 flex-1 bg-transparent text-body text-ink dark:text-ink placeholder:text-mute focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="검색어 지우기"
              className="pressable flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-mute dark:text-mute"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={close}
          className="pressable flex-shrink-0 min-h-[44px] px-2 text-label font-semibold text-accent dark:text-accent"
          style={{ touchAction: 'manipulation' }}
        >
          취소
        </button>
      </div>

      {/* 본문: 최근 검색 or 결과 */}
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {trimmed === '' ? (
          <div>
            <p className="px-3 pt-1 pb-1 text-caption font-semibold text-mute dark:text-mute uppercase tracking-wide">
              최근 검색
            </p>
            {recentSearches.length === 0 ? (
              <p className="px-3 py-6 text-body text-mute dark:text-mute">
                최근 검색한 노선·정류장이 여기에 표시돼요.
              </p>
            ) : (
              <div className="flex flex-col">
                {recentSearches.map((entry) => (
                  <RecentRow
                    key={`${entry.type}:${entry.id}`}
                    entry={entry}
                    onSelect={handleSelect}
                    onRemove={removeRecentSearch}
                  />
                ))}
              </div>
            )}
          </div>
        ) : results.length === 0 ? (
          <p className="px-3 py-10 text-body text-mute dark:text-mute text-center">
            일치하는 결과가 없어요
          </p>
        ) : (
          <div className="flex flex-col">
            {results.map((entry) => (
              <ResultRow key={`${entry.type}:${entry.id}`} entry={entry} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
