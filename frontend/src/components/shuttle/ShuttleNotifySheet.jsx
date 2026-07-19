/**
 * ShuttleNotifySheet — 셔틀 알림 예약 바텀시트(F3-3, 스펙 예시 16).
 * ShuttleTimetable의 종 아이콘에서 열리며, 리드타임(10분 전/5분 전/출발 시)을
 * 고른 뒤 "알림 켜기"를 누르면 부모가 전달한 onConfirm(leadMinutes)이 실행된다.
 * 실제 예약 상태(localStorage/setTimeout)는 useShuttleAlarms가 담당하고, 이
 * 컴포넌트는 순수 표시 + 선택 UI만 맡는다.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import StationChips from '../ui/StationChips'
import {
  SHUTTLE_ALARM_LEAD_OPTIONS,
  formatShuttleAlarmSheetTitle,
} from '../../utils/shuttleAlarmMessage'

export default function ShuttleNotifySheet({ open, time, directionLabel, onClose, onConfirm }) {
  const [lead, setLead] = useState(SHUTTLE_ALARM_LEAD_OPTIONS[0].id)
  const [submitting, setSubmitting] = useState(false)
  const [errorReason, setErrorReason] = useState(null)

  // 시트를 새로 열 때마다 선택 상태를 초기화한다.
  useEffect(() => {
    if (open) {
      setLead(SHUTTLE_ALARM_LEAD_OPTIONS[0].id)
      setSubmitting(false)
      setErrorReason(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleConfirm = async () => {
    setSubmitting(true)
    setErrorReason(null)
    const result = await onConfirm(lead)
    setSubmitting(false)
    if (result && result.ok === false) {
      setErrorReason(result.reason ?? 'denied')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center"
      aria-modal="true"
      role="dialog"
      aria-label={formatShuttleAlarmSheetTitle(time)}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div
        className="relative z-10 w-full md:max-w-sm bg-surface dark:bg-surface rounded-t-sheet md:rounded-sheet shadow-sh-pop flex flex-col animate-slide-up"
      >
        {/* grab 핸들 */}
        <div className="flex justify-center pt-3.5 pb-1 flex-shrink-0 md:hidden">
          <div className="w-11 h-1 rounded-full bg-line-strong dark:bg-line-strong" />
        </div>

        <div className="px-5 pt-2 md:pt-5 pb-1">
          <h2 className="text-page-ttl text-ink dark:text-ink">
            {formatShuttleAlarmSheetTitle(time)}
          </h2>
          {directionLabel && (
            <p className="mt-1 text-meta font-semibold text-mute dark:text-mute tracking-tight">
              {directionLabel}
            </p>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-label font-semibold text-ink-2 dark:text-ink-2 mb-2.5">
            언제 알려드릴까요?
          </p>
          <StationChips
            items={SHUTTLE_ALARM_LEAD_OPTIONS}
            active={lead}
            onChange={setLead}
            variant="direction"
          />

          {errorReason === 'denied' && (
            <p className="mt-3 text-meta font-semibold text-delayed dark:text-delayed">
              브라우저 알림 권한이 꺼져있어요. 설정에서 알림을 허용해주세요.
            </p>
          )}
          {errorReason && errorReason !== 'denied' && (
            <p className="mt-3 text-meta font-semibold text-delayed dark:text-delayed">
              알림을 켜지 못했어요. 다시 시도해주세요.
            </p>
          )}
        </div>

        <div className="px-5 pb-5 pt-1 flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-button text-label font-bold text-ink-2 dark:text-ink-2 bg-surface-2 dark:bg-surface-2 pressable"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-[2] h-11 rounded-button text-label font-bold text-white bg-accent dark:bg-accent pressable disabled:opacity-60"
          >
            {submitting ? '설정 중...' : '알림 켜기'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
