/**
 * NoticeHighlights — 더보기 탭 상단 공지 히어로 카드 (시안1 · 핀 칩 + 액센트 글로우 변형).
 *
 * 시안1 특징:
 *   - 좌측 스트라이프 제거 → 핀 아이콘 칩(accent 배경 30×30) + 글로우 효과
 *   - hero bg: 항상 어두운 톤(dock-bg 토큰 — FloatingDock과 같은 "상시 다크 크롬" 취급)
 *   - 우상단 블러 처리된 accent 글로우
 *   - 카드 안 "전체 공지 보기" chevron CTA
 *
 * 색은 전부 --tj-* 토큰(Tailwind dock-bg/accent/white 유틸)만 쓴다 — 예전엔
 * linear-gradient/rgba에 하드코딩된 hex(#1a211e, #202221, rgba(18,165,148,…) 등)를
 * 직접 박아 뒀었다.
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
      aria-label={`공지: ${top.title}`}
      className="pressable relative w-full text-left mb-3 overflow-hidden rounded-sheet bg-dock-bg px-5 pt-5 pb-[18px] shadow-sh-pop"
    >
      {/* 우상단 글로우 — 블러 처리된 accent 원 (rgba/radial-gradient 대신 blur 유틸) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-accent/45 blur-3xl"
      />

      {/* 킥커 행: 핀 칩 + 태그 + 날짜 */}
      <div className="relative flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-button bg-accent text-white"
        >
          <Pin size={14} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-px">
          <span className="text-dest font-extrabold text-accent tracking-[0.08em]">
            고정 공지
          </span>
          <span className="text-dest font-semibold text-white/60">
            {fmtDate(top.created_at)}
          </span>
        </div>
      </div>

      {/* 제목 */}
      <div className="relative mt-3.5 text-[19px] font-extrabold leading-[1.32] tracking-[-0.02em] text-white">
        {top.title}
      </div>

      {/* 미리보기 */}
      {preview && (
        <div className="relative mt-2 text-caption font-medium leading-[1.6] text-white/80">
          {preview}
        </div>
      )}

      {/* 전체 공지 보기 CTA */}
      <span className="relative mt-3.5 inline-flex items-center gap-1 text-caption font-extrabold text-white">
        전체 공지 보기
        <ChevronRight size={15} aria-hidden="true" />
      </span>
    </button>
  )
}
