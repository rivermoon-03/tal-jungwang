import { useNow } from '../../hooks/useNow'

/** 갱신 시각 표시. 점은 정적이고 시간만 흐른다. */
export default function Freshness({ fetchedAt, label = '실시간', tone = 'light' }) {
  const now = useNow(5000)
  if (!fetchedAt) return null
  const sec = Math.max(0, Math.round((now - fetchedAt) / 1000))
  const ago = sec < 60 ? `${sec}초 전` : `${Math.floor(sec / 60)}분 전`
  const stale = sec > 120
  const text = tone === 'dark' ? 'text-[#adb5b2]' : 'text-ink-2'
  return (
    <span className={`flex items-center gap-1.5 text-f13 ${text}`}>
      <span className={`h-2 w-2 rounded-full ${stale ? 'bg-imminent' : 'bg-accent'}`} aria-hidden="true" />
      {label} {ago}
    </span>
  )
}
