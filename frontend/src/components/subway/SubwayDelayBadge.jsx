/**
 * SubwayDelayBadge — 자체 감지 지하철 지연 배지 + 근거 팝오버 (베타).
 *
 * 백엔드가 실측 도착 이력과 시간표의 편차로 지연을 감지하면 실시간 항목에
 * delay_minutes/delay_since/delay_samples 가 붙는다. 이 배지는 그 값을 받아
 * "지연 약 +N분" 칩을 그리고, 탭하면 판정 근거(최근 도착 편차 범위·감지 시각)를
 * 팝오버로 펼친다 — WalkIndexChip.jsx 의 팝오버 패턴(바깥 탭·Esc 닫기)을 따른다.
 * 지연이 해소되면 백엔드 키가 TTL 로 사라져 배지도 자연 소멸한다.
 *
 * Props:
 *   direction {string}  팝오버 제목용 방향 라벨 (예: "상행", "수인분당선 상행")
 *   minutes   {number}  반올림된 지연 분 (null/undefined 면 렌더하지 않음)
 *   since     {string}  최초 감지 시각 ISO8601 (KST)
 *   samples   {number[]} 최근 편차(분) 샘플
 *   placement {'up'|'down'}  팝오버 방향 — 카드 헤더는 위(up), 보드 상단은 아래(down)
 */
import { useEffect, useId, useRef, useState } from 'react'
import { formatHHMM } from '../../utils/eta'

/**
 * since 는 KST ISO8601 이므로 표시도 KST 로 고정해야 한다. 예전에는 이 파일이
 * getHours() 로 브라우저 로컬 시각을 찍는 자체 formatHHMM 을 들고 있었다 -
 * 한국에서 보면 맞아떨어져서 드러나지 않았을 뿐, 다른 시간대에서는 감지 시각이
 * 통째로 어긋났다(UTC 에서 08:02 가 23:02 로 나온다). eta.js 의 KST 포매터에
 * 위임해 없앤다.
 */
function formatSince(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return formatHHMM(d.getTime())
}

export default function SubwayDelayBadge({ direction, minutes, since, samples, placement = 'up', className = '' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const panelId = useId()

  // 바깥 탭·Esc 로 닫는다 (WalkIndexChip 패턴).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (minutes == null) return null

  const nums = (Array.isArray(samples) ? samples : [])
    .map(Number)
    .filter((n) => Number.isFinite(n))
  const lo = nums.length ? Math.round(Math.min(...nums)) : null
  const hi = nums.length ? Math.round(Math.max(...nums)) : null
  const rangeText = lo == null ? `약 ${minutes}분` : lo === hi ? `약 ${lo}분` : `${lo}~${hi}분`
  const sinceText = formatSince(since)

  return (
    <span ref={wrapRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${direction} 지연 약 ${minutes}분 감지 · 근거 보기`}
        className="pressable inline-flex items-center rounded-full bg-delayed-bg px-2 py-0.5 text-caption font-bold text-delayed"
      >
        지연 약 +{minutes}분
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`${direction} 지연 감지 근거`}
          className={`absolute left-0 z-30 w-[216px] rounded-card border border-line bg-surface p-3 shadow-sh-pop text-left ${
            placement === 'down' ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
          }`}
        >
          <p className="text-caption font-bold text-ink">{direction} 지연 감지</p>
          <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            <p className="text-caption">
              <span className="text-mute">최근 도착</span>
              <span className="text-ink-2 font-semibold"> · 시간표보다 {rangeText} 늦음</span>
            </p>
            {sinceText && (
              <p className="text-caption">
                <span className="text-mute">감지 시각</span>
                <span className="text-ink-2 font-semibold"> · {sinceText}부터</span>
              </p>
            )}
          </div>
          <p className="mt-2 text-micro font-medium text-mute leading-relaxed">
            베타 · 자체 감지. 해소되면 배지가 자동으로 사라져요
          </p>
        </div>
      )}
    </span>
  )
}
