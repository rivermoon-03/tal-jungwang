/**
 * EmptyState — 데이터가 0건일 때 보여주는 공통 빈 상태.
 *
 * PC 리팩터 이전에는 각 화면이 리스트가 비면 아무것도 렌더하지 않아, 사용자가
 * 로딩 중인지 고장인지 구분할 수 없었다(지도 필터/검색/즐겨찾기/등교 방향).
 * 문구와 여백을 한 곳에서 관리하려고 공통 컴포넌트로 뺐다.
 *
 * Props:
 *   icon        lucide 아이콘 컴포넌트 (옵션)
 *   title       한 줄 요약 (필수)
 *   description 보조 설명 (옵션)
 *   action      하단 버튼 등 ReactNode (옵션)
 *   size        'sm' | 'md'  — sm은 패널 안쪽, md는 페이지 전체 영역용
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  className = '',
}) {
  const isSm = size === 'sm'

  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center ${
        isSm ? 'gap-2 px-4 py-8' : 'h-full gap-3 px-6 py-12'
      } ${className}`}
    >
      {Icon && (
        <Icon
          size={isSm ? 24 : 32}
          className="text-mute dark:text-mute"
          aria-hidden="true"
        />
      )}
      <p
        className={`font-semibold text-ink-2 dark:text-mute ${
          isSm ? 'text-label' : 'text-body'
        }`}
      >
        {title}
      </p>
      {description && (
        <p className="max-w-[34ch] text-meta leading-relaxed text-mute dark:text-mute">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
