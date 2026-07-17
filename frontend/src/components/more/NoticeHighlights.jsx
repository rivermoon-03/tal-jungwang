/**
 * NoticeHighlights — 더보기 탭 상단 공지 히어로 카드 (시안1 · 핀 칩 + 액센트 글로우 변형).
 *
 * 시안1 특징:
 *   - 좌측 스트라이프 제거 → 핀 아이콘 칩(accent 배경 30×30) + 글로우 효과
 *   - hero bg: linear-gradient(150deg, #1a211e, #202221) — sage12/sage3(다크) 톤
 *   - 우상단 radial-gradient 글로우 (accent 반투명)
 *   - 카드 안 "전체 공지 보기" chevron CTA
 *
 * Props:
 *   onOpen?: (notice) => void — 카드/CTA 클릭 시 호출 (NoticesPage 라우팅 위임)
 */
import { ChevronRight, Pin } from 'lucide-react'
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
        padding: '20px 20px 18px',
        borderRadius: 18,
        background: 'linear-gradient(150deg, #1a211e 0%, #202221 100%)',
        color: '#fff',
        border: 'none',
        boxShadow: '0 8px 22px rgba(26,33,30,0.24)',
        cursor: 'pointer',
      }}
      aria-label={`공지: ${top.title}`}
    >
      {/* 우상단 글로우 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: -50,
          top: -50,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(18,165,148,0.45), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* 킥커 행: 핀 칩 + 태그 + 날짜 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'rgba(18,165,148,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <Pin size={14} aria-hidden="true" />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: 'var(--tj-accent)',
              letterSpacing: '0.08em',
            }}
          >
            고정 공지
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.60)' }}>
            {fmtDate(top.created_at)}
          </span>
        </div>
      </div>

      {/* 제목 */}
      <div
        style={{
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginTop: 14,
          lineHeight: 1.32,
        }}
      >
        {top.title}
      </div>

      {/* 미리보기 */}
      {preview && (
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.82)',
            fontWeight: 500,
            lineHeight: 1.6,
            marginTop: 8,
          }}
        >
          {preview}
        </div>
      )}

      {/* 전체 공지 보기 CTA */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 14,
          fontSize: 13,
          fontWeight: 800,
          color: '#fff',
        }}
      >
        전체 공지 보기
        <ChevronRight size={15} aria-hidden="true" />
      </span>
    </button>
  )
}
