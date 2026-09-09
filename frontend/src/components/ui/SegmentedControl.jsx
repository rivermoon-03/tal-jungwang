import { useLayoutEffect, useRef, useState } from 'react'

/**
 * SegmentedControl
 * 상호배타 선택지 그룹(등교/하교, 버스/지하철, 평일/토/일 …)의 단일 구현체.
 *
 * 높이는 md·sm 모두 44px 다. sm 이 바꾸는 것은 높이가 아니라 폭 거동(컨테이너를
 * 채우지 않고 콘텐츠만큼만)과 글자 크기다. 카드 위에 얹히는 자리라도 손가락
 * 크기는 같다.
 *
 * Props:
 *   options   {value, label, disabled?, title?}[]
 *   value     string             현재 선택값
 *   onChange  (value) => void
 *   onDisabledClick (value) => void  비활성 항목을 눌렀을 때(토스트 등)
 *   size      'md'|'sm'          기본 'md'. 'sm'은 inline-flex + 작은 글자.
 *   ariaLabel string             role="tablist" 컨테이너 라벨
 *   className string             컨테이너에 덧붙일 클래스
 *
 * 선택 배경은 항상 var(--tj-pill-active-bg)만 참조한다 — 라이트는 잉크 검정 필,
 * 다크는 토큰 안에서 이미 accent teal로 반전되어 있다(index.css .dark 블록).
 * 이 컴포넌트가 teal을 직접 선택 배경으로 하드코딩하지 않는 이유는 DESIGN.md §5
 * "teal은 손전등"(진행중/CTA/실시간 전용, 대면적 배경 금지) 규율 때문 — 다크
 * 반전은 토큰이 이미 책임지므로 컴포넌트는 토큰만 참조하면 라이트/다크 모두
 * 규율을 어기지 않는다.
 *
 * 트랙 배경(dark:bg-bg dark:border dark:border-line): --tj-surface-2는 라이트에서
 * --tj-bg 바로 위 한 단(sage2)이지만 다크에서는 두 단(sage3)이라, 다크에서만
 * 트랙과 페이지 배경 사이 색차가 커져 옅은 경계로 도드라졌다(실측: 라이트
 * delta 4/255, 다크 delta 16/255). 다크에서는 채움을 페이지 배경과 맞추고 대신
 * 보더로 층을 구분한다(DESIGN.md §4 "다크는 그림자 대신 보더").
 *
 * role="tablist"/role="tab"/aria-selected 조합을 쓴다(aria-pressed 대신) —
 * 상호배타 선택지 그룹의 표준 ARIA 패턴이다.
 *
 * 활성 세그먼트 배경은 실제 DOM 위치를 측정해 슬라이드하는 단일 인디케이터로
 * 구현한다(DESIGN.md §4 "세그먼트 인디케이터 슬라이드" — e-out/dur-motion-base).
 */
export default function SegmentedControl({
  options = [],
  value,
  onChange,
  onDisabledClick,
  size = 'md',
  ariaLabel,
  className = '',
}) {
  const compact = size === 'sm'
  const containerRef = useRef(null)
  const btnRefs = useRef(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  // 활성 버튼 위치/폭을 측정해 인디케이터를 맞춘다. 마운트 시 한 번만 재면
  // 컨테이너 폭(flex-1)이나 웹폰트가 나중에 정착할 때 stale해져 활성 탭과
  // 어긋난다. ResizeObserver + 폰트 로드 후 재측정으로 항상 정렬한다.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const btn = btnRefs.current.get(value)
      if (!container || !btn) return
      const cRect = container.getBoundingClientRect()
      const bRect = btn.getBoundingClientRect()
      // scrollLeft 를 더하는 이유: 가로 스크롤되는 트랙(노선 탭처럼 항목이
      // 넘치는 경우)에서 rect 차이는 화면상 거리라 스크롤한 만큼 어긋난다.
      // 인디케이터는 스크롤되는 콘텐츠 기준으로 놓여야 한다.
      setIndicator({
        left: bRect.left - cRect.left + container.scrollLeft,
        width: bRect.width,
        ready: true,
      })
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
      className={[
        'relative flex items-center gap-1 p-1 rounded-button',
        'bg-surface-2 dark:bg-bg dark:border dark:border-line',
        compact ? 'inline-flex' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <span
        aria-hidden="true"
        /* left-0 필수: 없으면 absolute 요소가 static 위치(패딩 4px)에서 시작해
           translateX에 이미 포함된 패딩만큼 오른쪽으로 이중 이동한다. */
        className="absolute top-1 bottom-1 left-0 rounded-badge bg-[var(--tj-pill-active-bg)] transition-[transform,width] duration-base ease-out"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value
        const isDisabled = Boolean(opt.disabled)
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
            aria-disabled={isDisabled}
            title={opt.title}
            onClick={() => {
              if (isDisabled) onDisabledClick?.(opt.value)
              else onChange?.(opt.value)
            }}
            className={[
              'relative z-10 flex items-center justify-center gap-1',
              // 44px는 md·sm 공통이다. 최소 터치 영역은 밀도와 협상하지 않는다.
              'min-h-[44px] px-3 whitespace-nowrap',
              compact ? '' : 'flex-1',
              'rounded-badge font-bold select-none',
              compact ? 'text-meta' : 'text-label',
              'transition-colors duration-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tj-focus-ring)]',
              isDisabled ? 'opacity-40 cursor-not-allowed' : 'pressable',
              isActive ? 'text-[var(--tj-pill-active-fg)]' : 'bg-transparent text-mute',
            ].filter(Boolean).join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
