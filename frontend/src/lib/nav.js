import { useSyncExternalStore } from 'react'

// pushState 라우팅. popstate 를 직접 쏴서 구독자 전부가 같은 경로로 다시 그린다.
export function navigate(href, { replace = false } = {}) {
  const here = window.location.pathname + window.location.search
  if (here === href) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

export function goBack(fallback = '/') {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, { replace: true })
}

function subscribe(cb) {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}
const snapshot = () => window.location.pathname + window.location.search

/** 현재 { pathname, query } 를 구독한다. */
export function useLocation() {
  const href = useSyncExternalStore(subscribe, snapshot, () => '/')
  const url = new URL(href, 'http://local')
  return { pathname: url.pathname, query: url.searchParams }
}

/** <a> 클릭을 SPA 이동으로 바꾼다. 새 탭 열기(수정키)는 브라우저에 맡긴다. */
export function linkProps(href) {
  return {
    href,
    onClick: (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      navigate(href)
    },
  }
}
