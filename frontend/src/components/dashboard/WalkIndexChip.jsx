/**
 * WalkIndexChip — 이동 지수 칩 + 근거 팝오버.
 *
 * 예전에는 `title` 속성 하나로 근거를 달았는데, 네이티브 툴팁은 **터치에서 뜨지
 * 않는다**. 이 앱은 대부분 폰으로 보므로 "걷기 좋음"의 근거를 사실상 아무도
 * 볼 수 없었다. 그래서 탭하면 열리는 팝오버로 바꾸고, 서버가 준 항목별 근거
 * (기온·강수확률·미세먼지, 낙뢰 감지 시 낙뢰 행)를 그대로 펼친다 — 판정을
 * 끌어내린 항목에는 표시를 달고, 하단에 판정 출처(발표 회차)를 한 줄 남긴다.
 *
 * Props:
 *   walkIndex {level, label, reason, factors[], sourceLabel}
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 팝오버 폭. 위치 계산과 클래스가 같은 값을 봐야 화면 밖으로 안 나간다.
const PANEL_W = 188
// 화면 가장자리에서 최소한 띄우는 여백.
const EDGE_GAP = 12

export default function WalkIndexChip({ walkIndex }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()

  // 히어로 루트가 펼침 애니메이션 때문에 overflow:hidden 이라, 팝오버를 그 안에
  // 두면 어느 방향으로 열어도 잘린다(위로 열면 상단이, 아래로 열면 하단이).
  // body 로 포털해 겹침 컨텍스트 밖으로 꺼내고 위치는 버튼 사각형에서 잰다.
  // 닫을 때 pos 를 비우지 않는 이유: useLayoutEffect 가 페인트 전에 다시 재므로
  // 남은 값이 화면에 나올 일이 없다(NoticesPopover 와 같은 관례).
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const btn = btnRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelH = panelRef.current?.offsetHeight ?? 0
      const below = window.innerHeight - r.bottom - EDGE_GAP
      // 기본은 아래다. 아래가 모자라고 위가 더 넓을 때만 위로 뒤집는다.
      const flipUp = panelH > 0 && below < panelH && r.top - EDGE_GAP > below
      const left = Math.min(
        Math.max(EDGE_GAP, r.left),
        window.innerWidth - PANEL_W - EDGE_GAP,
      )
      setPos({
        left,
        top: flipUp ? undefined : r.bottom + 6,
        bottom: flipUp ? window.innerHeight - r.top + 6 : undefined,
        maxHeight: Math.max(120, (flipUp ? r.top : below) - 6),
      })
    }

    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // 바깥 탭·Esc 로 닫는다. 지도/카드 위에 겹치는 히어로라, 열어둔 채로 다른 걸
  // 누르면 팝오버가 남아 화면을 가린다.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
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
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`이동 지수 ${walkIndex.label} · 근거 보기`}
        className={`whero-windpill ${strong ? 'is-strong' : ''} pressable inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-bold`}
      >
        {walkIndex.label}
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="이동 지수 근거"
          style={{
            left: pos?.left ?? 0,
            top: pos?.top,
            bottom: pos?.bottom,
            maxHeight: pos?.maxHeight,
            // 첫 프레임은 높이를 모르니 숨겨 그린다. 재는 즉시 제자리로 간다.
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="fixed z-popover w-[188px] overflow-y-auto rounded-card border border-line bg-surface p-3 shadow-sh-card"
        >
          <p className="text-caption font-bold text-ink">{walkIndex.reason}</p>
          <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            {factors.map((f) => (
              <p key={f.key} className="flex items-center gap-1.5 text-caption">
                <span className="flex-1 min-w-0 truncate text-mute">{f.label}</span>
                {/* 낙뢰 행은 존재 자체가 경고라 decisive 여부와 무관하게 imminent 톤 */}
                <span
                  className={`tabular-nums font-semibold ${
                    f.decisive || f.key === 'lightning' ? 'text-imminent' : 'text-ink-2'
                  }`}
                >
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
          {walkIndex.sourceLabel && (
            // 판정 출처(발표 회차). 초단기예보로 판정했는지, 단기예보로 저하됐는지 드러낸다.
            <p className="mt-2 border-t border-line pt-2 text-micro text-mute">
              {walkIndex.sourceLabel}
            </p>
          )}
        </div>,
        document.body,
      )}
    </span>
  )
}
