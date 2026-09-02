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
 * 킥커 라벨은 "고정 공지"였지만 이 모델(useNotices → /more/notices)에는 is_pinned가
 * 없다 — 그냥 최신순 1번째 공지일 뿐이다. "고정"이라고 부르면 실제로 상단 고정
 * 여부와 무관하게 매번 최신 글이 "고정"으로 보여 거짓말이 된다. "새 공지"로 정직하게
 * 바꾸고, 계정이 없어 서버에 못 두는 읽음 상태는 기기 로컬(noticeReadState)로
 * 안읽음 도트를 붙인다.
 *
 * Props:
 *   onOpen?: (notice) => void — 카드/CTA 클릭 시 호출 (NoticesPage 라우팅 위임)
 */
import { ChevronRight, Pin } from 'lucide-react'
import { useNotices } from '../../hooks/useMore'
import { formatRelativeTime } from '../../utils/relativeTime'
import { isNoticeUnread } from '../../utils/noticeReadState'
import Skeleton from '../common/Skeleton'

const APP_NOTICE_CATEGORY = 'app'

function previewLine(content) {
  if (!content) return ''
  const normalized = content.replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim()
  return normalized.length > 80 ? `${normalized.slice(0, 80)}…` : normalized
}

// 히어로와 동일한 rounded-sheet 박스 골격 — 로딩 중엔 이 모양으로, 완료 후엔
// 실제 카드로 자리가 그대로 이어져 레이아웃이 튀지 않는다.
function HeroSkeleton() {
  return (
    <div
      className="mb-3 flex flex-col gap-3 overflow-hidden rounded-sheet bg-dock-bg px-5 pt-5 pb-[18px]"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <Skeleton width={30} height={30} rounded="rounded-button" />
        <Skeleton width={80} height="0.9rem" />
      </div>
      <Skeleton height="1.4rem" width="80%" />
      <Skeleton height="1rem" width="60%" />
    </div>
  )
}

export default function NoticeHighlights({ onOpen }) {
  const { data, loading, error } = useNotices()
  if (loading) return <HeroSkeleton />
  // 에러·빈 목록은 이 히어로가 아니라 그 아래 목록(AppNoticesTab)이 책임진다 —
  // 히어로와 목록이 각자 같은 에러/빈 문구를 중복해 보여주지 않기 위함이다.
  if (error) return null
  const notices = Array.isArray(data) ? data : []
  if (notices.length === 0) return null

  const top = notices[0]
  const preview = previewLine(top.content)
  const unread = isNoticeUnread(APP_NOTICE_CATEGORY, top.id)

  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(top) : undefined}
      aria-label={`${unread ? '안읽음 · ' : ''}공지: ${top.title}`}
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
          <span className="flex items-center gap-1.5 text-dest font-extrabold text-accent tracking-[0.08em]">
            새 공지
            {/* 안읽음 도트 — 읽으면(NoticesPage 방문) 자리를 비워 정렬은 그대로 둔다. */}
            <span
              aria-hidden="true"
              className={`h-[7px] w-[7px] rounded-full ${unread ? 'bg-accent' : ''}`}
            />
          </span>
          <span className="text-dest font-semibold text-white/60">
            {formatRelativeTime(top.created_at)}
          </span>
        </div>
      </div>

      {/* 제목 */}
      <div className="relative mt-3.5 text-title-sm font-extrabold leading-[1.32] tracking-[-0.02em] text-white">
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
