import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import IconButton from '../ui/IconButton';

/**
 * PWA 설치 배너
 *
 * - 이미 standalone(설치됨) 모드일 때는 렌더링하지 않음
 * - 7일 내에 dismiss한 경우에도 렌더링하지 않음
 * - Chrome/Android: beforeinstallprompt 이벤트 → 네이티브 설치 다이얼로그
 * - iOS Safari: "공유 → 홈 화면에 추가" 안내 모달
 *
 * App.jsx 연결은 Stream C에서 담당.
 * 사용 예시: <PWAInstallBanner />
 */
export default function PWAInstallBanner() {
  const { canInstall, isInstalled, isDismissed, isIOS, promptInstall, dismiss } =
    usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  // 데스크톱 Chrome도 beforeinstallprompt를 쏘기 때문에 PC에서 배너가 상단을 덮고
  // 사이드바 로고까지 가렸다. 설치형 PWA는 휴대폰에서 쓰는 시나리오라 PC는 제외한다.
  const isDesktop = useIsDesktop();

  const hidden = isInstalled || isDismissed || isDesktop || (!canInstall && !isIOS);

  // 배너가 실제로 렌더링되는 동안 --banner-h CSS 변수를 설정한다. 배너가 흐름
  // 안에 들어간 뒤로 레이아웃 보정 용도로는 쓰지 않지만, 배너 유무를 CSS 에서
  // 알아야 하는 곳을 위해 남긴다.
  useEffect(() => {
    if (hidden) {
      document.documentElement.style.setProperty('--banner-h', '0px');
      return;
    }
    document.documentElement.style.setProperty('--banner-h', '44px');
    return () => document.documentElement.style.setProperty('--banner-h', '0px');
  }, [hidden]);

  // 이미 설치되었거나, 7일 내 dismiss했거나, 데스크톱인 경우 렌더링 불필요
  if (isInstalled || isDismissed || isDesktop) return null;

  const handleIOSModalClose = () => setShowIOSModal(false);

  // Chrome/Android: native prompt
  const handleInstall = () => {
    if (canInstall) {
      promptInstall();
    } else if (isIOS) {
      setShowIOSModal(true);
    }
  };

  // 배너를 표시할 조건: canInstall(Chrome) 또는 isIOS
  if (!canInstall && !isIOS) return null;

  return (
    <>
      {/* 상단 배너 — 레이아웃 흐름 안에 둔다(App 의 세로 flex 첫 자식). 예전엔
          fixed top-0 오버레이라 히어로의 지도 칩과 시간표 화면의 모드 탭 위에
          얹혀 그 자리의 탭을 가로챘다(실측: 자동화 클릭이 배너에 막힘). 이제
          아래 화면이 배너 높이만큼 내려간다. viewport-fit=cover 라 상단
          세이프에어리어는 padding 으로 보정한다. */}
      <div
        role="banner"
        aria-label="앱 설치 배너"
        className="relative z-toast flex flex-none items-center justify-between px-4 py-2 text-white"
        style={{
          backgroundColor: 'var(--tj-accent)',
          minHeight: '44px',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <button
          onClick={handleInstall}
          className="flex items-center gap-2 text-sm font-semibold flex-1 text-left"
          aria-label="앱 설치하기"
        >
          <Download size={16} aria-hidden="true" />
          <span>
            {isIOS
              ? '홈 화면에 추가해 빠르게 여세요'
              : '탈것:정왕 앱으로 설치하기'}
          </span>
        </button>
        <IconButton
          onClick={dismiss}
          label="배너 닫기"
          className="ml-3 !text-white hover:!bg-white/20 active:!bg-white/25"
        >
          <X size={16} aria-hidden="true" />
        </IconButton>
      </div>

      {/* iOS 안내 모달 */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="iOS 홈 화면 추가 안내"
          className="fixed inset-0 z-sheet flex items-end justify-center"
          onClick={handleIOSModalClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

          {/* Modal sheet — surface 토큰으로: bg-white 고정이라 다크 모드에서
              흰 카드가 그대로 떠 있었다. */}
          <div
            className="relative w-full max-w-sm mx-4 mb-6 bg-surface rounded-sheet shadow-sh-pop p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <IconButton
              onClick={handleIOSModalClose}
              label="닫기"
              className="absolute top-4 right-4"
            >
              <X size={20} />
            </IconButton>

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-sheet flex items-center justify-center mb-4 mx-auto"
              style={{ backgroundColor: 'var(--tj-accent-hover)' }}
              aria-hidden="true"
            >
              <span className="text-white font-semibold text-xl">TU</span>
            </div>

            <h2 className="text-center font-bold text-ink text-lg mb-1">
              홈 화면에 추가
            </h2>
            <p className="text-center text-sm text-mute mb-5">
              탈것:정왕을 홈 화면에 추가하면 앱처럼 빠르게 사용할 수 있어요.
            </p>

            {/* Steps */}
            <ol className="space-y-3 text-sm text-ink-2">
              <li className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--tj-accent)' }}
                >
                  1
                </span>
                <span>
                  하단 메뉴에서{' '}
                  <Share
                    size={14}
                    className="inline -mt-0.5"
                    aria-hidden="true"
                  />{' '}
                  <strong>공유</strong> 버튼을 탭하세요
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--tj-accent)' }}
                >
                  2
                </span>
                <span>
                  스크롤해서 <strong>홈 화면에 추가</strong>를 탭하세요
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--tj-accent)' }}
                >
                  3
                </span>
                <span>
                  오른쪽 상단 <strong>추가</strong>를 탭하면 완료!
                </span>
              </li>
            </ol>

            <button
              onClick={handleIOSModalClose}
              className="mt-5 w-full py-3 rounded-card font-semibold text-white text-sm"
              style={{ backgroundColor: 'var(--tj-accent)' }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
