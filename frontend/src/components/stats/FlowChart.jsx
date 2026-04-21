import { useMemo, useRef, useState } from 'react'
import { smoothPath } from '../../utils/splinePath'

// viewBox 기준. preserveAspectRatio="none"으로 카드 너비에 맞춰 늘린다.
const W = 320
const H = 160
const PAD_X = 16
const PAD_TOP = 16
const PAD_BOTTOM = 20
const SPEED_MAX = 50 // km/h 축 상한

function formatLabel(p) {
  const hh = String(p.hour).padStart(2, '0')
  const mm = String(p.minute).padStart(2, '0')
  return `${hh}:${mm}`
}

function classifySpeed(kmh) {
  if (kmh >= 17) return '원활'
  if (kmh >= 10) return '서행'
  return '정체'
}

export default function FlowChart({ points, stroke = '#ffffff', nowMinutes = null }) {
  const wrapRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)

  const geometry = useMemo(() => {
    if (!points || points.length === 0) return null
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_TOP - PAD_BOTTOM

    const coords = points.map((p) => {
      const x = PAD_X + ((p.hour + p.minute / 60) / 24) * innerW
      const y = PAD_TOP + (1 - Math.max(0, Math.min(1, p.speed / SPEED_MAX))) * innerH
      return { x, y }
    })
    const lineD = smoothPath(coords, 0.5)
    const last = coords[coords.length - 1]
    const first = coords[0]
    const areaD = `${lineD} L ${last.x},${H - PAD_BOTTOM} L ${first.x},${H - PAD_BOTTOM} Z`
    return { coords, lineD, areaD, innerW, innerH }
  }, [points])

  const nowX = useMemo(() => {
    if (nowMinutes == null) return null
    const innerW = W - PAD_X * 2
    return PAD_X + (nowMinutes / 1440) * innerW
  }, [nowMinutes])

  const handleMove = (e) => {
    if (!geometry || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < geometry.coords.length; i++) {
      const d = Math.abs(geometry.coords[i].x - relX)
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    setHoverIdx(best)
  }

  const handleLeave = () => setHoverIdx(null)

  const active =
    hoverIdx != null && geometry && points[hoverIdx]
      ? { ...geometry.coords[hoverIdx], point: points[hoverIdx] }
      : null

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
        aria-label="마유로 24시간 속도 곡선"
      >
        <defs>
          <linearGradient id="flowArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[10, 20, 30, 40].map((v) => {
          const y = PAD_TOP + (1 - v / SPEED_MAX) * (H - PAD_TOP - PAD_BOTTOM)
          return (
            <line
              key={v}
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y}
              y2={y}
              stroke={stroke}
              strokeOpacity="0.18"
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {geometry && (
          <>
            <path d={geometry.areaD} fill="url(#flowArea)" />
            <path
              d={geometry.lineD}
              fill="none"
              stroke={stroke}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity="0.95"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}

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

        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={PAD_TOP}
            y2={H - PAD_BOTTOM}
            stroke={stroke}
            strokeOpacity="0.65"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {active && (
        <>
          <div
            className="absolute w-3 h-3 rounded-full shadow-md ring-2 ring-white/70"
            style={{
              left: pctLeft(active.x),
              top: pctTop(active.y),
              transform: 'translate(-50%, -50%)',
              background: stroke,
            }}
          />
          <div
            className="absolute px-2.5 py-1.5 rounded-lg bg-black/75 text-white backdrop-blur-sm whitespace-nowrap pointer-events-none"
            style={{
              left: pctLeft(active.x),
              top: pctTop(active.y),
              transform: 'translate(-50%, calc(-100% - 14px))',
            }}
          >
            <div className="text-[10px] opacity-70 tabular-nums text-center">
              {formatLabel(active.point)}
            </div>
            <div className="text-sm font-bold tabular-nums text-center">
              {active.point.speed.toFixed(1)}
              <span className="text-[10px] font-medium ml-0.5 opacity-80">km/h</span>
            </div>
            <div className="text-[10px] opacity-70 text-center">
              {classifySpeed(active.point.speed)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
