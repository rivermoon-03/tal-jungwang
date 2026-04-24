import { useState, useEffect, useCallback } from 'react';

const DISMISS_KEY = 'pwaBannerDismissedAt';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Encapsulates PWA install prompt logic.
 * Returns:
 *   canInstall   — true when Chrome/Edge beforeinstallprompt is available
 *   isInstalled  — true when running in standalone mode (already installed)
 *   isDismissed  — true when user dismissed within the last 7 days
 *   isIOS        — true on iOS Safari (needs manual "Add to Home Screen" instructions)
 *   promptInstall — call to show the native install dialog (Chrome/Android only)
 *   dismiss      — call to hide banner for 7 days
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (!ts) return false;
      return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
    } catch {
      return false;
    }
  });

  const isInstalled =
    (typeof window !== 'undefined' &&
      window.matchMedia('(display-mode: standalone)').matches) ||
    (typeof navigator !== 'undefined' && !!navigator.standalone);

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(ua) &&
    !(typeof window !== 'undefined' && window.MSStream);
  const isIOSSafari =
    isIOSDevice &&
    /Safari/.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(ua);
  // Public name kept as `isIOS` for backward compat; semantically "iOS Safari only".
  const isIOS =
    isIOSSafari &&
    !(typeof navigator !== 'undefined' && navigator.standalone);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // If installed after prompt, clear the stored prompt
    const installedHandler = () => setDeferredPrompt(null);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors (private browsing)
    }
    setIsDismissed(true);
  }, []);

  return {
    canInstall: !!deferredPrompt,
    isInstalled,
    isDismissed,
    isIOS,
    promptInstall,
    dismiss,
  };
}
