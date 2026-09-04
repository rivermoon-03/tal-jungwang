import { lazy } from 'react'
import { hasReloadedForChunkError, markReloadedForChunkError, clearReloadGuard } from './chunkReload'

// 배포 직후 스테일 청크(옛 해시 파일이 서버에서 사라진 경우) 복구용 가드.
// import 실패 시 세션당 1회만 새로고침하고, 그래도 실패하면 에러를 그대로 던진다(무한 루프 방지).
//
// 예전엔 App.jsx 안에서만 쓰는 지역 함수였다. MapView를 별도 청크로 내리면서
// MainShell·PCMainShell도 같은 가드가 필요해져 여기로 옮겼다 — 로직을
// 복제하면 한쪽만 고치고 잊는 사고가 나기 쉽다.
export function lazyWithReload(importer) {
  return lazy(() =>
    importer()
      .then((mod) => {
        clearReloadGuard()
        return mod
      })
      .catch((err) => {
        if (!hasReloadedForChunkError()) {
          markReloadedForChunkError()
          window.location.reload()
          return new Promise(() => {}) // 리로드가 일어날 때까지 렌더를 보류한다
        }
        throw err
      })
  )
}
