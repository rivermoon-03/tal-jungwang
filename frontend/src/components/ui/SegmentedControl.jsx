import { useLayoutEffect, useRef, useState } from 'react'

/**
 * SegmentedControl
 * 등교/하교 방향 토글 등 전역에서 공유하는 표준 세그먼트 컨트롤.
 *
 * 리디자인 전에는 같은 의미의 토글이 4가지 스타일로 흩어져 있었다(대시보드
 * 아웃라인 칩 / 상세 블랙 필 / 통계시트 teal 필 / 시간표 민트 칩). 이 컴포넌트가
 * 그 넷을 대체하는 단일 구현이다.
 *
 * Props:
 *   options   {value, label}[]  세그먼트 목록
 *   value     string            현재 선택값 (options 중 하나의 value)
 *   onChange  (value) => void   선택 변경 핸들러
 *   size      'md'|'sm'         기본 'md'. 'sm'은 풀사이즈 폭을 채우지 않고
 *             컨텐츠만큼만 차지(카드 위에 작게 얹는 용도).
 *   ariaLabel string            role="tablist" 컨테이너의 접근성 라벨(필수 권장)
 *
 * 선택 배경은 항상 var(--tj-pill-active-bg)만 참조한다 — 라이트는 잉크 검정 필,
 * 다크는 토큰 안에서 이미 accent teal로 반전되어 있다(index.css .dark 블록).
 * 이 컴포넌트가 teal을 직접 선택 배경으로 하드코딩하지 않는 이유는 DESIGN.md §5
 * "teal은 손전등"(진행중/CTA/실시간 전용, 대면적 배경 금지) 규율 때문 — 다크
 * 반전은 토큰이 이미 책임지므로 컴포넌트는 토큰만 참조하면 라이트/다크 모두
 * 규율을 어기지 않는다.
 *
 * role="tablist"/role="tab"/aria-selected 조합을 쓴다(aria-pressed 대신) —
 * 이 셋은 상호배타 선택지 그룹의 표준 ARIA 패턴이고, 기존 SegmentTabs.jsx도
 * 동일 패턴이라 두 컴포넌트의 접근성 트리가 일관된다.
 *
 * 활성 세그먼트 배경은 실제 DOM 위치를 측정해 슬라이드하는 단일 인디케이터로
 * 구현한다(DESIGN.md §4 "세그먼트 인디케이터 슬라이드" — e-out/dur-motion-base).
 */
export default function SegmentedControl({ options = [], value, onChange, size = 'md', ariaLabel }) {
  const compact = size === 'sm'
  const containerRef = useRef(null)
  const btnRefs = useRef(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  // 활성 버튼 위치/폭을 측정해 인디케이터를 맞춘다. 컨테이너 폭(flex-1)이나
  // 웹폰트가 나중에 정착하는 경우까지 대비해 ResizeObserver + 폰트 로드 완료
  // 후 재측정으로 항상 정렬을 유지한다(SegmentTabs.jsx와 동일 전략).
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const btn = btnRefs.current.get(value)
      if (!container || !btn) return
      const cRect = container.getBoundingClientRect()
      const bRect = btn.getBoundingClientRect()
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width, ready: true })
    }
    measure()

    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      ro.observe(container)
    }
    let cancelled = false
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) measure() })

    return () => {
      cancelled = true
      if (ro) ro.disconnect()
    }
  }, [value, options])

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative flex items-center gap-0.5 bg-surface-3 rounded-button p-[3px] ${compact ? 'inline-flex' : ''}`}
    >
      <span
        aria-hidden="true"
        /* left-0 필수: 없으면 absolute 요소가 static 위치(패딩 3px)에서 시작해
           translateX에 이미 포함된 패딩만큼 이중 이동한다(SegmentTabs.jsx와 동일 이슈). */
        className="absolute top-[3px] bottom-[3px] left-0 rounded-badge bg-[var(--tj-pill-active-bg)] transition-[transform,width] duration-base ease-out"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            ref={(el) => {
              if (el) btnRefs.current.set(opt.value, el)
              else btnRefs.current.delete(opt.value)
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={[
              'relative z-10 flex items-center justify-center',
              compact ? 'min-h-[30px] px-3' : 'min-h-[38px] px-3 flex-1',
              'rounded-badge text-mini-ttl font-bold select-none pressable',
              'transition-colors duration-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tj-focus-ring)]',
              isActive ? 'text-[var(--tj-pill-active-fg)]' : 'bg-transparent text-mute',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
