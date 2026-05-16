/**
 * NoticeHighlights — 더보기 탭 상단의 공지 히어로 카드 (B안).
 *
 * Props:
 *   onOpen?: (notice) => void  — 카드 클릭 시 호출 (NoticesPage 라우팅 위임)
 *
 * 동작:
 *   - useNotices()로 공지 fetch
 *   - 첫 번째 공지를 shuttle(#1b3a6e) 그라데이션 + 좌측 4px accent 스트라이프 + 📌 PINNED 배지로 강조
 *   - 데이터 없음/로딩/에러이면 null
 */
import { useNotices } from '../../hooks/useMore'

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${Math.max(1, diffMin)}분 전`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}시간 전`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function previewLine(content) {
  if (!content) return ''
  const normalized = content.replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim()
  return normalized.length > 80 ? `${normalized.slice(0, 80)}…` : normalized
}

export default function NoticeHighlights({ onOpen }) {
  const { data, loading, error } = useNotices()
  if (loading || error) return null
  const notices = Array.isArray(data) ? data : []
  if (notices.length === 0) return null

  const top = notices[0]
  const preview = previewLine(top.content)

  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(top) : undefined}
      className="pressable w-full text-left mb-3"
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 20px 18px 22px',
        borderRadius: 14,
        background: 'linear-gradient(160deg, #102c4c, #1b3a6e)',
        color: '#fff',
        border: 'none',
        boxShadow: '0 4px 14px rgba(16, 44, 76, 0.18)',
      }}
      aria-label={`공지: ${top.title}`}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: 'var(--tj-accent)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 800,
            color: '#fff',
            background: 'var(--tj-accent)',
            padding: '3px 8px',
            borderRadius: 999,
            letterSpacing: '0.02em',
          }}
        >
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3h-.08c-.53 0-.92.5-.75 1L6 17h5v4l1 1 1-1v-4h5l1.84-4c.16-.5-.22-1-.75-1H19c-1.66 0-3-1.34-3-3z"/>
          </svg>
          공지
        </span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 700 }}>
          {fmtDate(top.created_at)}
        </span>
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          marginTop: 10,
          lineHeight: 1.3,
        }}
      >
        {top.title}
      </div>
      {preview && (
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.85)',
            fontWeight: 600,
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          {preview}
        </div>
      )}
    </button>
  )
}
