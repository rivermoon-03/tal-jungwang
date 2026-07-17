import { useEffect, useRef, useState } from 'react'

// 매초 ETA 분이 바뀔 때 위로 슬라이드해서 교체되는 숫자.
// value: 표시할 숫자(혹은 짧은 문자, 예: "곧"). prevValue 추적은 내부 ref로.
//
// 한 자릿수 / 두 자릿수 모두 지원. value가 동일하면 애니메이션 없음.
// duration 400ms / cubic-bezier(0.65, 0, 0.35, 1) — spec 5.1
export default function SlotNumber({ value, className = '' }) {
  const v = String(value ?? '')
  const prevRef = useRef(v)
  const [reel, setReel] = useState({ from: v, to: v, animating: false })

  useEffect(() => {
    if (prevRef.current === v) return
    setReel({ from: prevRef.current, to: v, animating: true })
    const id = setTimeout(() => {
      prevRef.current = v
      setReel({ from: v, to: v, animating: false })
    }, 400)
    return () => clearTimeout(id)
  }, [v])

  // 폭은 max(from.length, to.length)에 맞춘 ch 단위
  const width = `${Math.max(reel.from.length, reel.to.length)}ch`
  const translate = reel.animating ? '-1em' : '0'

  return (
    <span
      className={`relative inline-block overflow-hidden align-top leading-[1em] ${className}`}
      style={{ width, height: '1em' }}
    >
      <span
        className="block transition-transform duration-slot ease-inout"
        style={{ transform: `translateY(${translate})` }}
      >
        <span className="block h-[1em] leading-[1em]">{reel.from}</span>
        <span className="block h-[1em] leading-[1em]">{reel.to}</span>
      </span>
    </span>
  )
}
