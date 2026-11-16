import { useNow } from '../../hooks/useNow'

/** 갱신 시각 표시. */
export default function Freshness({ fetchedAt, label = '실시간', tone = 'light' }) {
  const now = useNow(5000)
  if (!fetchedAt) return null
  const sec = Math.max(0, Math.round((now - fetchedAt) / 1000))
  const ago = sec < 60 ? `${sec}초 전` : `${Math.floor(sec / 60)}분 전`
  const stale = sec > 120
  // 2분 넘게 갱신이 없으면 글자색으로만 알린다.
  const text = stale ? 'text-amber-600 dark:text-amber-400' : tone === 'dark' ? 'text-[#adb5b2]' : 'text-ink-2'
  return <span className={`text-f13 ${text}`}>{label ? `${label} ${ago}` : ago}</span>
}
