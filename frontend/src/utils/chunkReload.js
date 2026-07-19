// 배포 직후 브라우저 탭이 계속 열려 있으면, 이전 빌드의 해시 청크가 서버에서
// 사라져 lazy import가 실패할 수 있다. 이 모듈은 세션당 1회만 자동 새로고침해
// 최신 청크를 받아오게 하고, 새로고침 후에도 실패하면 무한 루프 없이 에러를 낸다.
const GUARD_KEY = 'chunk-reload-guard'

export function hasReloadedForChunkError() {
  return sessionStorage.getItem(GUARD_KEY) === '1'
}

export function markReloadedForChunkError() {
  sessionStorage.setItem(GUARD_KEY, '1')
}

export function clearReloadGuard() {
  sessionStorage.removeItem(GUARD_KEY)
}

export function reloadOnceForChunkError() {
  if (hasReloadedForChunkError()) return false
  markReloadedForChunkError()
  window.location.reload()
  return true
}
