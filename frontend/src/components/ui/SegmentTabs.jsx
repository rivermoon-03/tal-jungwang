import { useLayoutEffect, useRef, useState } from 'react'

/**
 * SegmentTabs
 * 모드/방향 선택에 사용하는 세그먼트 탭 컴포넌트.
 *
 * Props:
 *   items    {id, label}[]  탭 목록
 *   active   string         활성 탭 id
 *   onChange (id) => void   탭 클릭 핸들러
 *   size     'md'|'sm'      기본 'md'. 'sm'은 풀사이즈가 아니라 카드/캘린더
 *            위에 작게 얹히는 용도(컨테이너 폭을 채우지 않고 콘텐츠만큼만 차지).
 *
 * 활성 탭 배경은 실제 DOM 위치를 측정해 슬라이드하는 단일 인디케이터로 구현
 * (DESIGN.md §4 "세그먼트 인디케이터 슬라이드" — e-out/dur-motion-base).
 *
 * 트랙 배경(dark:bg-bg dark:border dark:border-line): --tj-surface-2는 라이트에서
 * --tj-bg 바로 위 한 단(sage2)이지만 다크에서는 두 단(sage3)이라, 다크에서만
 * 트랙과 페이지 배경 사이 색차가 커져 옅은 경계로 도드라졌다(실측: 라이트
 * delta 4/255, 다크 delta 16/255). TimetableSection.jsx/BusTimetableDetail.jsx가
 * 이미 쓰는 관례(bg-surface-2 dark:bg-bg + border)를 그대로 따라, 다크에서는
 * 채움을 페이지 배경과 맞추고 대신 보더로 층을 구분한다(DESIGN.md §4 "다크는
 * 그림자 대신 보더"). 라이트는 기존 그대로 두어 이미 옅은 delta를 유지한다.
 */
export default function SegmentTabs({ items = [], active, onChange, size = 'md' }) {
  const compact = size === 'sm'
  const containerRef = useRef(null)
  const btnRefs = useRef(new Map())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  // 활성 버튼 위치/폭을 측정해 인디케이터를 맞춘다. 마운트 시 한 번만 측정하면
  // 컨테이너 폭(flex-1)이나 웹폰트가 나중에 정착할 때 인디케이터가 stale해져
  // 활성 탭과 어긋난다(다크 pill이 텍스트를 안 덮음). ResizeObserver + 폰트 로드
  // 후 재측정으로 항상 정렬되게 한다.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const btn = btnRefs.current.get(active)
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
    // 웹폰트 로드로 글자폭이 바뀌면 버튼 폭도 바뀌므로 로드 완료 후 한 번 더.
    let cancelled = false
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) measure() })

    return () => {
      cancelled = true
      if (ro) ro.disconnect()
    }
  }, [active, items])

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={`relative flex items-center gap-1 bg-surface-2 dark:bg-bg dark:border dark:border-line rounded-btn p-1 ${compact ? 'inline-flex' : ''}`}
    >
      <span
        aria-hidden="true"
        /* left-0 필수: 없으면 absolute 요소가 static 위치(패딩 4px)에서 시작해
           translateX에 이미 포함된 패딩만큼(4px) 오른쪽으로 이중 이동한다. */
        className="absolute top-1 bottom-1 left-0 rounded-badge bg-ink dark:bg-accent transition-[transform,width] duration-base ease-out"
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
              'relative z-10 flex items-center justify-center',
              compact ? 'min-h-[34px] px-3' : 'min-h-[44px] px-3 flex-1',
              'rounded-badge',
              compact ? 'text-meta' : 'text-label',
              'font-semibold select-none pressable',
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
