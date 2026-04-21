import { useMemo, useRef, useState } from 'react'
import { smoothPath } from '../../utils/splinePath'

// viewBox 기준. preserveAspectRatio="none"으로 카드 너비에 맞춰 늘린다.
const W = 320
const H = 160
const PAD_X = 16
const PAD_TOP = 16
const PAD_BOTTOM = 20
const SPEED_MAX = 50 // km/h 축 상한

function filterByRange(points, curMin, rangeH) {
  if (rangeH === 24) return points
  const half = (rangeH / 2) * 60 // 6h→180, 12h→360
  const lo = Math.max(0, curMin - half)
  const hi = Math.min(1440, curMin + half)
  return points.filter((p) => {
    const m = p.hour * 60 + (p.minute ?? 0)
    return m >= lo && m <= hi
  })
}

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

export default function FlowChart({ points, stroke = '#ffffff', nowMinutes = null, rangeH = 24 }) {
  const wrapRef = useRef(null)
  const [hoverIdx, setHoverIdx] = useState(null)
  const [locked, setLocked] = useState(false)

  const filtered = useMemo(
    () => filterByRange(points, nowMinutes ?? 720, rangeH),
    [points, nowMinutes, rangeH],
  )

  const geometry = useMemo(() => {
    if (!filtered || filtered.length === 0) return null
    const innerW = W - PAD_X * 2
    const innerH = H - PAD_TOP - PAD_BOTTOM

    const minMin = filtered[0].hour * 60 + (filtered[0].minute ?? 0)
    const maxMin =
      filtered[filtered.length - 1].hour * 60 + (filtered[filtered.length - 1].minute ?? 0)
    const spanMin = maxMin - minMin || 1

    const coords = filtered.map((p) => {
      const m = p.hour * 60 + (p.minute ?? 0)
      const x = PAD_X + ((m - minMin) / spanMin) * innerW
      const y = PAD_TOP + (1 - Math.max(0, Math.min(1, p.speed / SPEED_MAX))) * innerH
      return { x, y }
    })
    const lineD = smoothPath(coords, 0.5)
    const last = coords[coords.length - 1]
    const first = coords[0]
    const areaD = `${lineD} L ${last.x},${H - PAD_BOTTOM} L ${first.x},${H - PAD_BOTTOM} Z`

    const speeds = filtered.map((p) => p.speed)
    const maxSpeed = Math.max(...speeds)
    const minSpeed = Math.min(...speeds)
    const maxIdx = filtered.findIndex((p) => p.speed === maxSpeed)
    const minIdx = filtered.findIndex((p) => p.speed === minSpeed)

    return { coords, lineD, areaD, innerW, innerH, minMin, spanMin, maxSpeed, minSpeed, maxIdx, minIdx }
  }, [filtered])

  const nowX = useMemo(() => {
    if (nowMinutes == null || !geometry) return null
    const x = PAD_X + ((nowMinutes - geometry.minMin) / geometry.spanMin) * geometry.innerW
    // 범위 밖이면 null
    if (x < PAD_X || x > W - PAD_X) return null
    return x
  }, [nowMinutes, geometry])

  const findNearest = (e) => {
    if (!geometry || !wrapRef.current) return null
    const rect = wrapRef.current.getBoundingClientRect()
    const clientX = e.clientX ?? e.touches?.[0]?.clientX
    if (clientX == null) return null
    const relX = ((clientX - rect.left) / rect.width) * W
    let best = 0
    let bestDist = Infinity
    for (let i = 0; i < geometry.coords.length; i++) {
      const d = Math.abs(geometry.coords[i].x - relX)
      if (d < bestDist) { bestDist = d; best = i }
    }
    return best
  }

  const handleMove = (e) => {
    if (locked) return
    const idx = findNearest(e)
    if (idx !== null) setHoverIdx(idx)
  }

  const handleDown = (e) => {
    const idx = findNearest(e)
    if (idx === null) return
    if (locked && hoverIdx === idx) {
      setLocked(false)
      setHoverIdx(null)
    } else {
      setLocked(true)
      setHoverIdx(idx)
    }
  }

  const handleLeave = () => {
    if (!locked) setHoverIdx(null)
  }

  const active =
    hoverIdx != null && geometry && filtered[hoverIdx]
      ? { ...geometry.coords[hoverIdx], point: filtered[hoverIdx] }
      : null

  const pctLeft = (x) => `${(x / W) * 100}%`
  const pctTop = (y) => `${(y / H) * 100}%`

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ height: 160, touchAction: 'none' }}
      onPointerMove={handleMove}
      onPointerDown={handleDown}
      onPointerLeave={handleLeave}
      onPointerCancel={handleLeave}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-label="마유로 속도 곡선"
      >
        <defs>
          <linearGradient id="flowArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.45" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
          <filter id="flowGlow" x="-5%" y="-60%" width="110%" height="220%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
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
              filter="url(#flowGlow)"
            />
            {geometry.coords.map((c, i) => {
              const isMax = i === geometry.maxIdx
              const isMin = i === geometry.minIdx && i !== geometry.maxIdx
              return (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={isMax || isMin ? 3.8 : 2.4}
                  fill={stroke}
                  fillOpacity={isMax || isMin ? 0.9 : 0.55}
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}
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

      {geometry && geometry.maxIdx >= 0 && (
        <div
          className="absolute pointer-events-none font-bold tabular-nums"
          style={{
            left: pctLeft(geometry.coords[geometry.maxIdx].x),
            top: pctTop(Math.max(0, geometry.coords[geometry.maxIdx].y - 16)),
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: stroke,
            textShadow: '0 1px 5px rgba(0,0,0,.85)',
          }}
        >
          {geometry.maxSpeed.toFixed(0)}
        </div>
      )}
      {geometry && geometry.minIdx >= 0 && geometry.minIdx !== geometry.maxIdx && (
        <div
          className="absolute pointer-events-none font-bold tabular-nums"
          style={{
            left: pctLeft(geometry.coords[geometry.minIdx].x),
            top: pctTop(Math.min(H * 0.88, geometry.coords[geometry.minIdx].y + 4)),
            transform: 'translateX(-50%)',
            fontSize: 10,
            color: stroke,
            opacity: 0.65,
            textShadow: '0 1px 5px rgba(0,0,0,.85)',
          }}
        >
          {geometry.minSpeed.toFixed(0)}
        </div>
      )}

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
