/**
 * GpsSoftPrompt — "내 위치" FAB 탭 시 geolocation 권한이
 * prompt/denied 상태일 때 노출하는 인라인 카드 (§9, §7.3).
 *
 * Props:
 *   permissionState — 'prompt' | 'denied' | 'granted'
 *   onClose         — () => void  (나중에 버튼 or 카드 닫기)
 *   onGranted       — () => void  (위치 획득 성공 후 호출)
 */

import { useState } from 'react'
import { MapPin, X } from 'lucide-react'

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export default function GpsSoftPrompt({ permissionState, onClose, onGranted }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  if (permissionState === 'granted') return null

  function handleAllow() {
    if (!navigator.geolocation) {
      setError('이 브라우저는 위치 서비스를 지원하지 않아요.')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        onGranted?.(pos)
        onClose?.()
      },
      (err) => {
        setLoading(false)
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setError('위치 권한이 거부됐어요. 브라우저 설정에서 허용해 주세요.')
        } else {
          setError('위치를 가져오는 데 실패했어요. 잠시 후 다시 시도해 주세요.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  const isDenied = permissionState === 'denied' || error?.includes('거부')

  return (
    <div
      className="absolute bottom-24 left-1/2 z-[80] bg-white dark:bg-[#272a33] rounded-card shadow-card w-[calc(100%-32px)] max-w-sm -translate-x-1/2"
      style={{
        animation: `slideUpFade 0.3s ${EASE} both`,
        padding: '14px 16px',
      }}
    >
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      {/* 닫기 버튼 */}
      <button
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        <X size={14} className="text-slate-400" />
      </button>

      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">📍</span>
        <div className="flex flex-col gap-2 flex-1">
          <p className="text-[14px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">
            위치 권한이 필요해요
          </p>

          {isDenied ? (
            <p className="text-[12px] text-[#717171] dark:text-[#94a3b8] leading-relaxed">
              브라우저 주소창 왼쪽 자물쇠 아이콘을 탭한 뒤,
              <br />
              <strong>위치 → 허용</strong>으로 변경해 주세요.
            </p>
          ) : (
            <p className="text-[12px] text-[#717171] dark:text-[#94a3b8]">
              도보 시간 계산과 탑승 가능 여부 확인에 사용돼요.
            </p>
          )}

          {error && !isDenied && (
            <p className="text-[11px] text-red-500">{error}</p>
          )}

          {!isDenied && (
            <div className="flex gap-2 mt-1">
              <button
                className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ background: '#102c4c' }}
                onClick={handleAllow}
                disabled={loading}
              >
                {loading ? '요청 중…' : '허용하기'}
              </button>
              <button
                className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-[#717171] dark:text-[#94a3b8] border border-[#ebebeb] dark:border-[#3a3e48] bg-white dark:bg-[#272a33]"
                onClick={onClose}
              >
                나중에
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * useGpsSoftPrompt — FAB 클릭 핸들러에서 사용할 헬퍼 훅.
 * 권한 상태를 비동기로 확인하고 결과를 반환.
 *
 * @returns {{ promptState: 'idle'|'prompt'|'denied'|'granted', checkAndShow: () => void, hide: () => void }}
 */
export function useGpsSoftPrompt() {
  const [promptState, setPromptState] = useState('idle')

  async function checkAndShow() {
    // navigator.permissions API 지원 여부 확인
    if (!navigator.permissions?.query) {
      // 지원 안 하면 바로 getCurrentPosition 시도 — prompt 상태로 간주
      setPromptState('prompt')
      return
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      if (result.state === 'granted') {
        setPromptState('granted')
      } else {
        setPromptState(result.state) // 'prompt' | 'denied'
      }
    } catch {
      // 조회 실패 시 prompt로 처리
      setPromptState('prompt')
    }
  }

  function hide() {
    setPromptState('idle')
  }

  return { promptState, checkAndShow, hide }
}
