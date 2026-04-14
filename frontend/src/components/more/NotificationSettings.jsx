/**
 * NotificationSettings — 알림 설정 UI.
 * - Master toggle (notifPrefs.enabled)
 * - Lead time radio: 5 · 10 · 15 · 20분
 * - Info block about supported routes
 * - PWA caveat if not installed
 */
import { Bell, BellOff, Home } from 'lucide-react'
import useAppStore from '../../stores/useAppStore'
import { usePWAInstall } from '../../hooks/usePWAInstall'

const LEAD_OPTIONS = [5, 10, 15, 20]

function Toggle({ on, onToggle, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="flex-shrink-0 relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: on ? '#FF385C' : '#CBD5E1' }}
    >
      <span
        className="absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
        style={{ left: on ? 'calc(100% - 1.5rem)' : '0.25rem' }}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const notifPrefs = useAppStore((s) => s.notifPrefs)

  function setEnabled(enabled) {
    useAppStore.setState((s) => ({
      notifPrefs: { ...s.notifPrefs, enabled },
    }))
  }

  function setLeadMin(leadMin) {
    useAppStore.setState((s) => ({
      notifPrefs: { ...s.notifPrefs, leadMin },
    }))
  }

  const { isInstalled, isIOS, canInstall, promptInstall } = usePWAInstall()
  const notStandalone = !isInstalled

  return (
    <div className="flex flex-col gap-4">
      {/* master toggle */}
      <div className="bg-white dark:bg-slate-800 rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 dark:text-slate-400">
              {notifPrefs.enabled ? <Bell size={20} /> : <BellOff size={20} />}
            </span>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">알림 받기</p>
              <p className="text-xs text-slate-400">즐겨찾기 출발 전 알림</p>
            </div>
          </div>
          <Toggle
            on={notifPrefs.enabled}
            onToggle={() => setEnabled(!notifPrefs.enabled)}
            label="알림 받기 토글"
          />
        </div>
      </div>

      {/* lead time */}
      {notifPrefs.enabled && (
        <div className="bg-white dark:bg-slate-800 rounded-[18px] border border-slate-100 dark:border-slate-700 shadow-card p-4">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3">출발 몇 분 전에 알림 받을까요?</p>
          <div className="grid grid-cols-4 gap-2">
            {LEAD_OPTIONS.map((min) => {
              const active = notifPrefs.leadMin === min
              return (
                <button
                  key={min}
                  onClick={() => setLeadMin(min)}
                  className={`py-2.5 rounded-[12px] text-sm font-bold transition-all pressable ${
                    active
                      ? 'bg-coral text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {min}분
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* info block */}
      <div className="bg-slate-100 dark:bg-slate-800/60 rounded-[14px] px-4 py-3 flex flex-col gap-1">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">알림 지원 대상</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          즐겨찾기한 <strong className="text-slate-700 dark:text-slate-300">광역버스(3400, 6502) · 시흥1 · 셔틀 · 지하철</strong>만 알림이 옵니다.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mt-0.5">
          20-1, 시흥33은 실시간 GBIS 기반이라 정확도가 낮아 알림에서 제외됩니다.
        </p>
      </div>

      {/* PWA caveat */}
      {notStandalone && (
        <div className="flex items-start gap-3 bg-navy/5 dark:bg-navy/20 border border-navy/10 dark:border-navy/30 rounded-[14px] px-4 py-3">
          <Home size={18} className="text-navy dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              홈 화면에 추가하면 알림이 더 잘 와요
            </p>
            {!isIOS && canInstall && (
              <button
                onClick={promptInstall}
                className="mt-1.5 text-xs font-bold text-navy dark:text-blue-400 underline underline-offset-2"
              >
                홈 화면에 추가하기
              </button>
            )}
            {isIOS && (
              <p className="mt-1.5 text-xs text-slate-400">
                Safari에서 공유(□↑) → 홈 화면에 추가
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
