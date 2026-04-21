import { useMemo, useRef, useState } from 'react'
import { crowdedColor, crowdedLabel } from '../../utils/crowdingPalette'

// 48개 버킷(30분) × 높이 = 혼잡도/4. 호버하면 tooltip + 현재 시각 dashed line.
const W = 320
const H = 160
const PAD_X = 12
const PAD_TOP = 16
const PAD_BOTTOM = 20
const CROWDED_MAX = 4

export default function CrowdingChart({ points, nowMinutes = null, stroke = '#ffffff' }) {
  const wrapRef = useRef(null)
  const [hoverKey, setHoverKey] = useState(null)

  const byKey = useMemo(() => {
    const m = new Map()
    for (const p of points) m.set(`${p.hour}:${p.minute}`, p)
    return m
  }, [points])

  const bars = useMemo(() => {
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_TOP - PAD_BOTTOM
    const barWidth = innerW / 48
    const gap = Math.max(1, barWidth * 0.12)
    const bw = barWidth - gap

    return Array.from({ length: 48 }, (_, i) => {
      const hour = Math.floor(i / 2)
      const minute = i % 2 === 0 ? 0 : 30
      const key = `${hour}:${minute}`
      const p = byKey.get(key)
      const v = p?.crowded ?? null
      const ratio = v != null ? (v - 1) / (CROWDED_MAX - 1) : 0 // 1→0, 4→1
      const minVisible = v != null ? 0.08 : 0
      const heightRatio = v != null ? Math.max(minVisible, ratio) : 0
      const barH = heightRatio * innerH
      const x = PAD_X + i * barWidth + gap / 2
      const y = H - PAD_BOTTOM - barH
      return { i, key, hour, minute, x, y, w: bw, h: barH, point: p }
    })
  }, [byKey])

  const nowX = useMemo(() => {
    if (nowMinutes == null) return null
    const innerW = W - PAD_X * 2
    return PAD_X + (nowMinutes / 1440) * innerW
  }, [nowMinutes])

  const handleMove = (e) => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const innerW = W - PAD_X * 2
    const idx = Math.max(0, Math.min(47, Math.floor(((relX - PAD_X) / innerW) * 48)))
    const hour = Math.floor(idx / 2)
    const minute = idx % 2 === 0 ? 0 : 30
    setHoverKey(`${hour}:${minute}`)
  }
  const handleLeave = () => setHoverKey(null)

  const hoverBar = hoverKey ? bars[bars.findIndex((b) => b.key === hoverKey)] : null
  const active = hoverBar && hoverBar.point ? hoverBar : null

  const pctLeft = (x) => `${(x / W) * 100}%`
  const pctTop = (y) => `${(y / H) * 100}%`

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ height: 160, touchAction: 'none' }}
      onPointerMove={handleMove}
      onPointerDown={handleMove}
      onPointerLeave={handleLeave}
      onPointerCancel={handleLeave}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-label="노선 24시간 혼잡도"
      >
        {/* 기준선 (혼잡도 2·3) */}
        {[2, 3].map((v) => {
          const ratio = (v - 1) / (CROWDED_MAX - 1)
          const y = H - PAD_BOTTOM - ratio * (H - PAD_TOP - PAD_BOTTOM)
          return (
            <line
              key={v}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke={stroke}
              strokeOpacity="0.15"
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {/* 빈 버킷은 얇은 점으로만 표시 */}
        {bars.map((b) => {
          if (!b.point) {
            return (
              <circle
                key={b.key}
                cx={b.x + b.w / 2}
                cy={H - PAD_BOTTOM - 2}
                r="0.9"
                fill={stroke}
                fillOpacity="0.28"
              />
            )
          }
          const color = crowdedColor(b.point.crowded)
          const isHover = hoverKey === b.key
          return (
            <rect
              key={b.key}
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={Math.min(1.6, b.w / 2)}
              fill={color}
              fillOpacity={isHover ? 1 : 0.92}
            />
          )
        })}

        {nowX != null && (
          <line
            x1={nowX}
            x2={nowX}
            y1={PAD_TOP}
            y2={H - PAD_BOTTOM}
            stroke={stroke}
            strokeOpacity="0.55"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {active && (
        <div
          className="absolute px-2.5 py-1.5 rounded-lg bg-black/80 text-white backdrop-blur-sm whitespace-nowrap pointer-events-none shadow-lg"
          style={{
            left: pctLeft(active.x + active.w / 2),
            top: pctTop(active.y),
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <div className="text-[10px] opacity-70 tabular-nums text-center">
            {String(active.hour).padStart(2, '0')}:{String(active.minute).padStart(2, '0')}
          </div>
          <div className="text-sm font-bold text-center" style={{ color: crowdedColor(active.point.crowded) }}>
            {crowdedLabel(active.point.crowded)}
          </div>
          <div className="text-[10px] opacity-70 text-center tabular-nums">
            평균 {active.point.crowded.toFixed(2)} · {active.point.samples}건
          </div>
        </div>
      )}
    </div>
  )
}
