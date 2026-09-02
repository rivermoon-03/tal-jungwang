/**
 * IconButton — 아이콘 하나만 있는 버튼의 정본.
 *
 * 약 30개 파일을 훑어 44px 에 도달하는 뒤로/닫기 버튼이 하나도 없었다.
 * 사실상의 관행이 36px(w-9 h-9)이었고 PWA 배너 닫기는 24px, 그 iOS 모달
 * 닫기는 20px 였다. 정작 하단 독은 min-w-[44px] min-h-[44px] 를 주석까지
 * 달아 지키고 있었다 — 기준을 몰라서가 아니라 강제할 프리미티브가 없었다.
 *
 * 아이콘 크기는 그대로 두고 패딩이 히트 영역을 만든다. 시각적으로 커지는 게
 * 아니라 누를 수 있는 범위가 커진다.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children  아이콘 노드(lucide 아이콘 등)
 * @param {string} props.label              접근성 라벨(필수)
 * @param {'ghost'|'surface'|'floating'} [props.variant]
 * @param {'md'|'lg'} [props.size]          md=44px, lg=48px
 * @param {string} [props.className]
 */
export default function IconButton({
  children,
  label,
  variant = 'ghost',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}) {
  const box = size === 'lg' ? 'min-h-[48px] min-w-[48px]' : 'min-h-[44px] min-w-[44px]'

  const tone = {
    // 배경 없이 잉크만. 목록/헤더 안에 얹는 기본형.
    ghost: 'text-ink-2 hover:bg-ink/[0.06] active:bg-ink/[0.1]',
    // 카드 위에 얹히는 형태. 보더 대신 표면 톤으로 구분한다.
    surface: 'bg-surface-2 text-ink-2 hover:bg-surface-3 active:bg-surface-3',
    // 지도 위처럼 배경을 신뢰할 수 없는 곳. 그림자로 띄운다.
    floating: 'bg-surface text-ink-2 shadow-sh-card hover:bg-surface-2',
  }[variant]

  return (
    <button
      type={type}
      aria-label={label}
      className={[
        'inline-flex flex-none items-center justify-center rounded-button',
        'transition-colors duration-press',
        box,
        tone,
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
