/**
 * WarnBanner — 경고 배너 (orange / blue / gray 3가지 변형)
 * Props:
 *   warn — { color: 'orange'|'blue'|'gray', text: string } | null
 */

const VARIANTS = {
  orange: 'bg-[#FFF7ED] text-orange-700 border border-orange-200',
  blue:   'bg-[#EFF6FF] text-blue-700 border border-blue-200',
  gray:   'bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
}

export default function WarnBanner({ warn }) {
  if (!warn) return null

  const cls = VARIANTS[warn.color] ?? VARIANTS.gray

  return (
    <div
      role="alert"
      className={`w-full px-4 py-2 text-xs font-medium rounded-lg mb-1 ${cls}`}
      style={{ transition: 'opacity 0.3s var(--ease-ios)' }}
    >
      {warn.text}
    </div>
  )
}
