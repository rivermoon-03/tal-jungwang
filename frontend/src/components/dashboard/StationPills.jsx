import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import useAppStore from '../../stores/useAppStore'
import useEffectiveDirection from '../../hooks/useEffectiveDirection'
import {
  BUS_STATION_LABELS,
  getAllowedDirections,
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
    const allItems = options ?? BUS_STATION_LABELS
    // 현재 방향에 맞는 정류장만 표시
    const items = allItems.filter((label) =>
      getAllowedDirections(label).includes(effectiveDirection)
    )
    const stationValue = value ?? selectedBusStation

    const handleSelectStation = (label) => {
      setBusStation(label)
      if (typeof onChange === 'function') onChange(label)
    }

    return (
      <div
        role="group"
        aria-label="정류장 선택"
        className="flex gap-1.5 px-4 pb-1.5 overflow-x-auto scrollbar-hide"
      >
        {items.map((label) => (
          <StationPillButton
            key={label}
            label={getBusStationDisplay(label)}
            active={stationValue === label}
            onClick={() => handleSelectStation(label)}
          />
        ))}
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
  const [menuRect, setMenuRect] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const updateRect = () => {
      const r = buttonRef.current?.getBoundingClientRect()
      if (r) setMenuRect({ top: r.bottom + 4, left: r.left, minWidth: r.width })
    }
    updateRect()
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleOutside = (e) => {
      const b = buttonRef.current
      const m = menuRef.current
      if (b && b.contains(e.target)) return
      if (m && m.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="pressable whitespace-nowrap"
        style={{
          padding: '10px 16px',
          borderRadius: 999,
          border: '1.5px solid var(--tj-pill-active-bg)',
          background: 'var(--tj-pill-active-bg)',
          color: 'var(--tj-pill-active-fg)',
          fontSize: 13,
          fontWeight: 800,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {label}
        <span style={{ opacity: .75, fontSize: 11, fontWeight: 700 }}>· {direction}</span>
        <span style={{ opacity: .6, fontSize: 10 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && menuRect && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label="방향 선택"
          style={{
            position: 'fixed',
            top: menuRect.top,
            left: menuRect.left,
            minWidth: Math.max(menuRect.minWidth, 112),
            background: '#fff',
            border: '1.5px solid var(--tj-line)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,.16)',
            overflow: 'hidden',
            zIndex: 9999,
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
                padding: '12px 18px',
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: '-0.01em',
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
        </div>,
        document.body
      )}
    </div>
  )
}

function StationPillButton({ label, suffix, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="pressable whitespace-nowrap"
      style={{
        padding: '10px 16px',
        borderRadius: 999,
        border: active
          ? '1.5px solid var(--tj-pill-active-bg)'
          : '1.5px solid var(--tj-line)',
        background: active ? 'var(--tj-pill-active-bg)' : 'transparent',
        color: active ? 'var(--tj-pill-active-fg)' : 'var(--tj-mute)',
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: '-0.01em',
        lineHeight: 1,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background var(--dur-press) var(--ease-ios), color var(--dur-press) var(--ease-ios), border-color var(--dur-press) var(--ease-ios)',
      }}
    >
      {label}
      {suffix && (
        <span style={{ opacity: .75, fontSize: 11, fontWeight: 700 }}>· {suffix}</span>
      )}
    </button>
  )
}
