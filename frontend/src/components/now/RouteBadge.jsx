// frontend/src/components/now/RouteBadge.jsx
import useAppStore from '../../stores/useAppStore'
import { routeColor } from '../../utils/routeColors'

export default function RouteBadge({ routeNumber, mode, category, size = 'md' }) {
  // useTheme() keeps darkMode in sync with themeMode. Read it here for color lookup.
  const isDark = useAppStore((s) => s.darkMode)
  const bg = routeColor({ mode, routeNumber, category }, isDark ? 'dark' : 'light')
  const px = size === 'sm'
    ? 'text-xs px-2 py-0.5 min-w-[40px]'
    : 'text-sm px-2.5 py-1 min-w-[52px]'
  return (
    <span
      className={`${px} text-center text-white font-bold rounded-lg whitespace-nowrap shrink-0`}
      style={{ backgroundColor: bg }}
    >
      {routeNumber}
    </span>
  )
}
