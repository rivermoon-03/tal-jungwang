import { useLayoutEffect, useRef, useState } from 'react'

/**
 * SegmentTabs
 * 모드/방향 선택에 사용하는 세그먼트 탭 컴포넌트.
 *
 * Props:
 *   items    {id, label}[]  탭 목록
 *   active   string         활성 탭 id
 *   onChange (id) => void   탭 클릭 핸들러
 *
 * 활성 탭 배경은 실제 DOM 위치를 측정해 슬라이드하는 단일 인디케이터로 구현
 * (DESIGN.md §4 "세그먼트 인디케이터 슬라이드" — e-out/dur-motion-base).
 */
export default function SegmentTabs({ items = [], active, onChange }) {
  const containerRef = useRef(null)
  const btnRefs = useRef(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  useLayoutEffect(() => {
    const container = containerRef.current
    const btn = btnRefs.current.get(active)
    if (!container || !btn) return
    const cRect = container.getBoundingClientRect()
    const bRect = btn.getBoundingClientRect()
    setIndicator({ left: bRect.left - cRect.left, width: bRect.width, ready: true })
  }, [active, items])

  return (
    <div
      ref={containerRef}
      role="tablist"
      className="relative flex items-center gap-1 bg-surface-2 rounded-btn p-1"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-badge bg-ink dark:bg-accent transition-[transform,width] duration-base ease-out"
        style={{
          width: indicator.width,
          transform: `translateX(${indicator.left}px)`,
          opacity: indicator.ready ? 1 : 0,
        }}
      />
      {items.map((item) => {
        const isActive = item.id === active
        return (
          <button
            key={item.id}
            ref={(el) => {
              if (el) btnRefs.current.set(item.id, el)
              else btnRefs.current.delete(item.id)
            }}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={[
              'relative z-10 flex-1 flex items-center justify-center',
              'min-h-[44px] px-3 rounded-badge',
              'text-label font-semibold select-none pressable',
              'transition-colors duration-base',
              isActive ? 'text-white dark:text-black' : 'bg-transparent text-ink-2',
            ].join(' ')}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
