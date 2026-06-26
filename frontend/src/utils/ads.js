// 웹 광고(Google AdSense 자동광고) 로더.
//
// AdSense는 일반 웹 페이지(브라우저 탭) 전용이며, 설치형 PWA나 Android TWA(웹뷰)
// 환경에서의 게재는 AdSense 프로그램 정책 위반 소지가 있다. 따라서:
//   - 브라우저 탭: 기존과 동일하게 자동광고 로드.
//   - 설치형 PWA / TWA(앱) 환경: 로드하지 않음.
//   - 앱 전용 빌드: VITE_DISABLE_WEB_ADS=1 로 완전 비활성화 가능.
//
// 인앱(앱) 광고가 필요하면 AdSense가 아닌 정책에 맞는 광고 SDK(AdMob 등)를 사용한다.

const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7686749566506134'

// 설치형 PWA / TWA(웹뷰)처럼 "앱"으로 실행 중인지 판별.
function isAppContext() {
  try {
    return !!(
      window.matchMedia?.('(display-mode: standalone)')?.matches ||
      window.matchMedia?.('(display-mode: fullscreen)')?.matches ||
      window.matchMedia?.('(display-mode: minimal-ui)')?.matches ||
      window.navigator.standalone === true ||
      document.referrer.startsWith('android-app://')
    )
  } catch {
    return false
  }
}

export function maybeLoadWebAds() {
  const disabled =
    import.meta.env.VITE_DISABLE_WEB_ADS === '1' ||
    import.meta.env.VITE_DISABLE_WEB_ADS === 'true'
  if (disabled) return
  if (isAppContext()) return
  if (document.querySelector('script[data-adsense]')) return

  const s = document.createElement('script')
  s.async = true
  s.src = ADSENSE_SRC
  s.crossOrigin = 'anonymous'
  s.setAttribute('data-adsense', '1')
  document.head.appendChild(s)
}
