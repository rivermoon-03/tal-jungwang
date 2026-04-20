/**
 * NoticeHighlights — 더보기 탭 상단의 공지 히어로 카드 (B안).
 *
 * Props:
 *   onOpen?: (notice) => void  — 카드 클릭 시 호출 (NoticesPage 라우팅 위임)
 *
 * 동작:
 *   - useNotices()로 공지 fetch
 *   - 첫 번째 공지를 navy 그라데이션 + 좌측 4px 액센트 스트라이프 + 📌 PINNED 배지로 강조
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
        padding: '14px 16px',
        borderRadius: 16,
        background: 'linear-gradient(160deg, #102c4c, #1b3a6e)',
        color: '#fff',
        border: 'none',
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
          background: 'var(--tj-accent-dark)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ opacity: 0.85, flexShrink: 0 }}
        >
          <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3h-.08c-.53 0-.92.5-.75 1L6 17h5v4l1 1 1-1v-4h5l1.84-4c.16-.5-.22-1-.75-1H19c-1.66 0-3-1.34-3-3z"/>
        </svg>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
          {fmtDate(top.created_at)}
        </span>
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          letterSpacing: '-0.02em',
          marginTop: 6,
        }}
      >
        {top.title}
      </div>
      {preview && (
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.8)',
            fontWeight: 500,
            lineHeight: 1.55,
            marginTop: 5,
          }}
        >
          {preview}
        </div>
      )}
    </button>
  )
}
