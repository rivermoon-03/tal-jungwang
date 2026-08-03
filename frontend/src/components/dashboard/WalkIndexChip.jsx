/**
 * WalkIndexChip — 이동 지수 칩 + 근거 팝오버.
 *
 * 예전에는 `title` 속성 하나로 근거를 달았는데, 네이티브 툴팁은 **터치에서 뜨지
 * 않는다**. 이 앱은 대부분 폰으로 보므로 "걷기 좋음"의 근거를 사실상 아무도
 * 볼 수 없었다. 그래서 탭하면 열리는 팝오버로 바꾸고, 서버가 준 항목별 근거
 * (기온·강수확률·미세먼지)를 그대로 펼친다 — 판정을 끌어내린 항목에는 표시를 단다.
 *
 * Props:
 *   walkIndex {level, label, reason, factors[]}
 */
import { useEffect, useId, useRef, useState } from 'react'

export default function WalkIndexChip({ walkIndex }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const panelId = useId()

  // 바깥 탭·Esc 로 닫는다. 지도/카드 위에 겹치는 히어로라, 열어둔 채로 다른 걸
  // 누르면 팝오버가 남아 화면을 가린다.
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

  if (!walkIndex) return null

  const strong = walkIndex.level === 'transit' || walkIndex.level === 'indoor'
  const factors = Array.isArray(walkIndex.factors) ? walkIndex.factors : []

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`이동 지수 ${walkIndex.label} · 근거 보기`}
        className={`whero-windpill ${strong ? 'is-strong' : ''} pressable inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-bold`}
      >
        {walkIndex.label}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="이동 지수 근거"
          // 위로 연다. 히어로 루트가 펼침 애니메이션 때문에 overflow:hidden 이라,
          // 아래로 열면 팝오버가 히어로 경계에서 잘려 첫 줄만 보인다.
          className="absolute left-0 bottom-full z-30 mb-1.5 w-[188px] rounded-card border border-line bg-surface p-3 shadow-sh-card"
        >
          <p className="text-caption font-bold text-ink">{walkIndex.reason}</p>
          <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            {factors.map((f) => (
              <p key={f.key} className="flex items-center gap-1.5 text-caption">
                <span className="flex-1 min-w-0 truncate text-mute">{f.label}</span>
                <span className={`tabular-nums font-semibold ${f.decisive ? 'text-imminent' : 'text-ink-2'}`}>
                  {f.value}
                </span>
                {f.decisive && (
                  <span className="rounded-full bg-imminent-bg px-1.5 text-micro font-bold text-imminent">
                    기준
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}
    </span>
  )
}
