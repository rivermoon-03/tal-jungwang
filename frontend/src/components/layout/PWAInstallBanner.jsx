import { useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

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

  // 이미 설치되었거나, 7일 내 dismiss한 경우 렌더링 불필요
  if (isInstalled || isDismissed) return null;

  // iOS: 배너를 클릭하면 안내 모달 표시
  const handleIOSBannerClick = () => setShowIOSModal(true);
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
      {/* 상단 고정 배너 */}
      <div
        role="banner"
        aria-label="앱 설치 배너"
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-white"
        style={{ backgroundColor: '#102c4c', minHeight: '44px' }}
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
        <button
          onClick={dismiss}
          className="ml-3 p-1 rounded-full hover:bg-white/20 transition-colors"
          aria-label="배너 닫기"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* iOS 안내 모달 */}
      {showIOSModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="iOS 홈 화면 추가 안내"
          className="fixed inset-0 z-[60] flex items-end justify-center"
          onClick={handleIOSModalClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

          {/* Modal sheet */}
          <div
            className="relative w-full max-w-sm mx-4 mb-6 bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleIOSModalClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              aria-label="닫기"
            >
              <X size={20} />
            </button>

            {/* Icon */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto"
              style={{ backgroundColor: '#1b3a6e' }}
              aria-hidden="true"
            >
              <span className="text-white font-black text-xl">TU</span>
            </div>

            <h2 className="text-center font-bold text-gray-900 text-lg mb-1">
              홈 화면에 추가
            </h2>
            <p className="text-center text-sm text-gray-500 mb-5">
              탈것:정왕을 홈 화면에 추가하면 앱처럼 빠르게 사용할 수 있어요.
            </p>

            {/* Steps */}
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex items-start gap-3">
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: '#102c4c' }}
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
                  style={{ backgroundColor: '#102c4c' }}
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
                  style={{ backgroundColor: '#102c4c' }}
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
              className="mt-5 w-full py-3 rounded-xl font-semibold text-white text-sm"
              style={{ backgroundColor: '#102c4c' }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
