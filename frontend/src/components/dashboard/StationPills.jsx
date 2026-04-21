import { useState, useRef, useEffect } from 'react'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import {
  BUS_STATION_LABELS,
  getAllowedDirections,
  getDefaultDirection,
  getBusStationDisplay,
} from './busStationConfig'

const SUBWAY_OPTIONS = ['정왕', '초지', '시흥시청']

const SHUTTLE_CAMPUS_OPTIONS = [
  { id: 'main',   label: '본캠' },
  { id: 'second', label: '2캠' },
]

export default function StationPills({ mode, value, onChange, options }) {
  const selectedBusStation     = useAppStore((s) => s.selectedBusStation)
  const selectedShuttleCampus  = useAppStore((s) => s.selectedShuttleCampus)
  const setBusStation          = useAppStore((s) => s.setBusStation)
  const setSubwayStation       = useAppStore((s) => s.setSubwayStation)
  const setShuttleCampus       = useAppStore((s) => s.setShuttleCampus)
  const setDirectionOverride   = useAppStore((s) => s.setDirectionOverride)
  const { direction: effectiveDirection } = useEffectiveDirection()

  if (mode === 'taxi') return null

  if (mode === 'shuttle') {
    const items = options ?? SHUTTLE_CAMPUS_OPTIONS
    const campusValue = value ?? selectedShuttleCampus

    const handleSelectCampus = (id) => {
      setShuttleCampus(id)
      if (typeof onChange === 'function') onChange(id)
    }

    return (
      <div
        role="group"
        aria-label="캠퍼스 선택"
        className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
      >
        {items.map((item) => (
          <StationPillButton
            key={item.id}
            label={item.label}
            active={campusValue === item.id}
            onClick={() => handleSelectCampus(item.id)}
          />
        ))}
      </div>
    )
  }

  if (mode === 'bus') {
    const items = options ?? BUS_STATION_LABELS
    const stationValue = value ?? selectedBusStation

    const handleSelectStation = (label) => {
      setBusStation(label)
      const nextAllowed = getAllowedDirections(label)
      if (!nextAllowed.includes(effectiveDirection)) {
        setDirectionOverride(getDefaultDirection(label))
      }
      if (typeof onChange === 'function') onChange(label)
    }

    return (
      <div
        role="group"
        aria-label="정류장 선택"
        className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
      >
        {items.map((label) => {
          const isActive = stationValue === label
          const allowed = getAllowedDirections(label)
          const isMultiDir = allowed.length > 1

          if (isActive && isMultiDir) {
            return (
              <DirectionDropdownPill
                key={label}
                label={getBusStationDisplay(label)}
                direction={effectiveDirection}
                onSelectDirection={(dir) => setDirectionOverride(dir)}
              />
            )
          }

          return (
            <StationPillButton
              key={label}
              label={getBusStationDisplay(label)}
              active={isActive}
              onClick={() => handleSelectStation(label)}
            />
          )
        })}
      </div>
    )
  }

  // subway
  const items = options ?? SUBWAY_OPTIONS
  if (items.length === 0) return null

  const handleSelect = (label) => {
    setSubwayStation(label)
    if (typeof onChange === 'function') onChange(label)
  }

  return (
    <div
      role="group"
      aria-label="역 선택"
      className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
    >
      {items.map((label) => (
        <StationPillButton
          key={label}
          label={label}
          active={value === label}
          onClick={() => handleSelect(label)}
        />
      ))}
    </div>
  )
}

function DirectionDropdownPill({ label, direction, onSelectDirection }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable whitespace-nowrap"
        style={{
          padding: '5px 11px',
          borderRadius: 999,
          border: '1.5px solid var(--tj-pill-active-bg)',
          background: 'var(--tj-pill-active-bg)',
          color: 'var(--tj-pill-active-fg)',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1.2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {label}
        <span style={{ opacity: .75, fontSize: 9 }}>· {direction}</span>
        <span style={{ opacity: .6, fontSize: 8 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="방향 선택"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            background: 'var(--tj-surface)',
            border: '1.5px solid var(--tj-line)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,.12)',
            overflow: 'hidden',
            zIndex: 50,
            minWidth: 72,
          }}
        >
          {['등교', '하교'].map((dir) => (
            <button
              key={dir}
              role="option"
              aria-selected={direction === dir}
              type="button"
              onClick={() => { onSelectDirection(dir); setOpen(false) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'left',
                background: direction === dir ? 'var(--tj-pill-active-bg)' : 'transparent',
                color: direction === dir ? 'var(--tj-pill-active-fg)' : 'var(--tj-ink)',
                border: 'none',
                cursor: 'pointer',
                borderBottom: dir === '등교' ? '1px solid var(--tj-line)' : 'none',
              }}
            >
              {dir}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StationPillButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="pressable whitespace-nowrap"
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        border: active
          ? '1.5px solid var(--tj-pill-active-bg)'
          : '1.5px solid var(--tj-line)',
        background: active ? 'var(--tj-pill-active-bg)' : 'transparent',
        color: active ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
      }}
    >
      {label}
    </button>
  )
}
