/**
 * TransitCard
 * 버스·지하철·셔틀 공용 도착 카드 규격. 해부도 고정:
 * [노선배지][본문(제목+칩행)][ETA 열] — grid-template-columns: auto 1fr auto.
 *
 * Props:
 *   badge     {label, bgVar?}
 *     bgVar는 노선색 CSS 변수 또는 hex 문자열(노선색은 DB ui_meta에서 오므로
 *     hex 그대로 전달 가능 — RouteBadge와 동일 관례). 넘기지 않으면 이 컴포넌트
 *     내부 기본값(chip-gray 토큰, DESIGN.md 카테고리 칩 팔레트)을 쓴다.
 *   title     string   행선지(예: "시흥시청행"). 15px bold, 절대 말줄임 금지,
 *             최대 2줄(line-clamp-2). 폭이 좁아지면 title이 아니라 칩 행이
 *             먼저 잘려 숨는다(아래 chips 컨테이너의 overflow-hidden 참고).
 *   subtitle? string   title 옆에 붙는 보조 라벨(예: "상행"). 12.5px mute.
 *   chips?    {label, tone}[]  tone: 'realtime'|'neutral'|'warn'. 12px.
 *             순서는 호출자가 고정한다(실시간→혼잡→경유 순 권장) — 이 컴포넌트는
 *             넘어온 순서 그대로 렌더링만 한다.
 *   eta       {
 *               primary: {text, tone},  tone: 'default'|'imminent'|'muted'
 *               secondary?: {text}
 *             }
 *     primary는 22px bold + tabular-nums. imminent tone은 색만 var(--tj-imminent)
 *     로 바꾸고 보더/배경은 절대 건드리지 않는다(DESIGN.md — 색만으로 강조,
 *     대면적 강조 금지). secondary가 없어도 자리(2번째 줄)는 항상 예약해
 *     리스트에서 카드 높이가 흔들리지 않게 한다.
 *   onClick?  () => void  있으면 카드 전체가 button(포커스링/press 모션 포함),
 *             없으면 순수 div.
 *   muted?    boolean  미운행 등 — title을 mute 색으로.
 *   sleeping? {label?}  지금이 운행 시간대 밖(막차 이후·첫차 이전)일 때 제목 아래
 *             한 줄로 달 아이콘 + "Zzz"를 붙인다. 칩으로 넣지 않는 이유: 칩 행은
 *             폭이 좁아지면 잘려 숨는데(overflow-hidden), 이 상태는 숨으면 안 된다.
 *
 * 카드 셸: bg-surface, border-line, rounded-card(14px), p-3(12px). 그림자는
 * 절대 추가하지 않는다(DESIGN.md §4 "보더+그림자 동시 사용 금지").
 * 그리드 가운데 열(본문)에는 min-w-0을 둬 긴 텍스트가 그리드 트랙을 밀어
 * ETA 열을 밀어내는 오버플로를 막는다.
 */

import { Moon } from 'lucide-react'

const CHIP_TONE_CLASS = {
  realtime: 'bg-accent-bg text-accent-ink',
  neutral: 'bg-chip-gray-bg text-chip-gray-fg',
  warn: 'bg-imminent-bg text-imminent',
}

const ETA_TONE_CLASS = {
  default: 'text-ink',
  imminent: 'text-imminent',
  muted: 'text-mute',
}

export default function TransitCard({
  badge,
  title,
  subtitle,
  chips = [],
  eta,
  onClick,
  muted = false,
  sleeping = null,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  const primaryTone = ETA_TONE_CLASS[eta?.primary?.tone] ?? ETA_TONE_CLASS.default

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'grid grid-cols-[auto_1fr_auto] items-center gap-3',
        'bg-surface border border-line rounded-card p-3 text-left',
        onClick
          ? 'w-full appearance-none pressable cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tj-focus-ring)]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* 노선 배지 — whitespace-nowrap: "20-1" 같은 하이픈 노선번호가 좁은 폭에서
          "20-"/"1" 두 줄로 꺾이던 문제(D3) 방지 */}
      <span
        className={[
          'inline-flex items-center justify-center shrink-0',
          'rounded-badge px-2 py-[3px] text-[15px] font-semibold tabular-nums leading-none select-none whitespace-nowrap',
          badge?.bgVar ? '' : 'bg-chip-gray-bg text-chip-gray-fg',
        ].filter(Boolean).join(' ')}
        style={badge?.bgVar ? { backgroundColor: badge.bgVar, color: '#ffffff' } : undefined}
      >
        {badge?.label}
      </span>

      {/* 본문: 제목 + 칩 행 */}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <h3
            className={[
              'flex-1 min-w-0 text-[15px] font-bold leading-snug line-clamp-2',
              muted ? 'text-mute' : 'text-ink',
            ].join(' ')}
          >
            {title}
          </h3>
          {subtitle && (
            // min-w-0 + truncate: 폭이 부족하면 말줄임한다. shrink-0이면 자기 그리드
            // 칸을 뚫고 ETA 열 밑으로 그대로 깔리는 겹침(D2)이 생겼다.
            <span className="min-w-0 truncate text-[12.5px] text-mute">{subtitle}</span>
          )}
        </div>

        {sleeping && (
          <div className="flex items-center gap-1 text-[12px] font-bold text-mute">
            <Moon size={12} aria-hidden="true" className="shrink-0" />
            <span>Zzz</span>
            {sleeping.label && <span className="font-semibold truncate">· {sleeping.label}</span>}
          </div>
        )}

        {chips.length > 0 && (
          // overflow-hidden(줄바꿈 없음) — 폭이 좁아지면 칩이 잘려 숨고, title의
          // line-clamp-2 두 줄 공간은 그대로 보장된다.
          <div className="flex items-center gap-1 overflow-hidden">
            {chips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className={[
                  'inline-flex items-center gap-1 shrink-0 rounded-full px-1.5 py-px',
                  'text-[12px] font-semibold leading-none whitespace-nowrap select-none',
                  CHIP_TONE_CLASS[chip.tone] ?? CHIP_TONE_CLASS.neutral,
                ].join(' ')}
              >
                {chip.tone === 'realtime' && (
                  <span
                    aria-hidden="true"
                    className="w-1 h-1 rounded-full bg-accent-ink animate-dot-blink"
                  />
                )}
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ETA 열 — 항상 2줄 높이 고정(secondary 없어도 자리 예약).
          min-w-0을 두면 auto 트랙이 내용보다 줄고, items-end 정렬 때문에 넘친
          텍스트가 왼쪽(본문 위)으로 그려져 겹침(D2)이 생긴다 — 두지 말 것. */}
      <div className="shrink-0 flex flex-col items-end justify-center gap-0.5 min-h-[44px]">
        <span
          className={[
            eta?.primary?.tone === 'muted'
              // muted는 "현재 도착 정보 없음" 같은 상태 문장 — 숫자 ETA처럼 22px로
              // 키우지 않고 줄바꿈을 허용해 좁은 폭에서도 카드 밖으로 안 나가게 한다.
              ? 'text-[15px] font-semibold leading-tight break-keep text-right max-w-[150px]'
              : 'text-[22px] font-bold tabular-nums leading-none',
            primaryTone,
          ].join(' ')}
        >
          {eta?.primary?.text}
        </span>
        <span className="text-[12.5px] text-mute tabular-nums leading-none">
          {eta?.secondary?.text ?? ' '}
        </span>
      </div>
    </Tag>
  )
}
