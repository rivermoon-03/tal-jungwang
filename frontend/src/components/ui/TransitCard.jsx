/**
 * TransitCard
 * 버스·지하철·셔틀 공용 도착 카드 규격("다정한 카드" 시안2). 해부도 고정:
 * [노선 타일 56px][본문(제목+칩행)][ETA 열] — grid-template-columns: auto 1fr auto.
 * 모든 도착 리스트 행(대시보드 ArrivalRow, 요약 패널, 노선 상세)이 이 다섯 자리
 * 순서를 그대로 따른다 — 화면마다 배치가 흔들리면 스캔 속도가 떨어진다.
 *
 * Props:
 *   badge     {label, bgVar?, mode?}
 *     bgVar는 노선색 CSS 변수 또는 hex 문자열(노선색은 DB ui_meta에서 오므로
 *     hex 그대로 전달 가능 — RouteBadge와 동일 관례). 넘기지 않으면 이 컴포넌트
 *     내부 기본값(chip-gray 토큰, DESIGN.md 카테고리 칩 팔레트)을 쓴다.
 *     mode는 'bus'|'subway'|'shuttle' — 타일 위에 노선 종류 글리프를 얹는다.
 *     생략하면 글리프 없이 번호만(호출부가 아직 종류를 안 넘기는 경우 폴백).
 *   title     string   행선지(예: "시흥시청행"). 15px bold, 절대 말줄임 금지,
 *             최대 2줄(line-clamp-2). 폭이 좁아지면 title이 아니라 칩 행이
 *             먼저 잘려 숨는다(아래 chips 컨테이너의 overflow-hidden 참고).
 *   subtitle? string   title 옆에 붙는 보조 라벨(예: "상행"). 13px mute.
 *   chips?    {label, tone}[]  tone: 'realtime'|'neutral'|'warn'|'good'|'delayed'|'beta'. 12px.
 *             good=잔여좌석 여유(chip-green), delayed=만차(delayed 토큰),
 *             beta=신규 기능 표기(StatusChip beta와 같은 보더+뮤트 스타일).
 *             순서는 호출자가 고정한다(실시간→혼잡/좌석→제보→경유 순 권장) —
 *             이 컴포넌트는 넘어온 순서를 존중하되, 화면에는 최대 2개까지만
 *             보여주고 나머지는 "+N" 칩 하나로 접는다(칩 상한 — BusPanel처럼
 *             한 행에 7개까지 쌓이는 화면에서 행이 무한정 넓어지는 것을 막는다).
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
 *   size?     'md'|'lg'  기본 'md'. 'lg'는 홈 화면의 "다음 차 카드"(이음매 아래
 *             첫 카드, 시안 스펙) 전용 — 같은 목록 안에서 딱 하나만 크게 보여
 *             "이게 다음 차다"를 한눈에 알려준다. 타일·제목·ETA 폰트를 키우고
 *             그림자를 shadow-sh-lift로 올린다(평범한 카드는 shadow-sh-card만).
 *   muted?    boolean  미운행 등 — title을 mute 색으로.
 *   sleeping? {label?}  지금이 운행 시간대 밖(막차 이후·첫차 이전)일 때 제목 아래
 *             한 줄로 달 아이콘 + "Zzz"를 붙인다. 칩으로 넣지 않는 이유: 칩 행은
 *             폭이 좁아지면 잘려 숨는데(overflow-hidden), 이 상태는 숨으면 안 된다.
 *
 * 카드 셸: bg-surface, rounded-card(20px) + shadow-sh-card. 시안2는 보더 대신
 * 그림자로 표면을 띄운다 — 보더와 그림자를 동시에 쓰지 않는다(DESIGN.md §4).
 * 그리드 가운데 열(본문)에는 min-w-0을 둬 긴 텍스트가 그리드 트랙을 밀어
 * ETA 열을 밀어내는 오버플로를 막는다.
 */

import { Moon, Bus, TrainFront, Route as RouteGlyph } from 'lucide-react'

// 노선 타일 크기(56px, w-14/h-14) — 대시보드·요약 패널·노선 상세 목록 전 화면
// 공통. 노선 종류별 글리프로 색만으로 구분하지 않는다(접근성 원칙 — 색은 보조 신호).
const MODE_GLYPH = { bus: Bus, subway: TrainFront, shuttle: RouteGlyph }

const CHIP_TONE_CLASS = {
  realtime: 'bg-accent-bg text-accent-ink',
  neutral: 'bg-chip-gray-bg text-chip-gray-fg',
  warn: 'bg-imminent-bg text-imminent',
  // 잔여좌석 여유(11석 이상) — 카테고리 칩 팔레트의 green 토큰
  good: 'bg-chip-green-bg text-chip-green-fg',
  // 만차 — 지연/불가 의미색 (imminent보다 한 단계 강한 상태)
  delayed: 'bg-delayed-bg text-delayed',
  // 신규 기능 베타 표기 — StatusChip beta와 동일한 보더+뮤트 스타일
  beta: 'border border-line text-mute',
}

const ETA_TONE_CLASS = {
  default: 'text-ink',
  imminent: 'text-imminent',
  muted: 'text-mute',
}

// 칩 상한 — BusPanel처럼 실시간·잔여좌석·정거장·베타·제보·돌발·경유가 한 행에
// 다 쌓이면(최대 7개) 카드가 무한정 넓어진다. 2개만 보여주고 나머지는 "+N"
// 칩 하나로 접는다(개수만 말하고 내용은 숨기지 않는다 — 상세는 카드 탭으로).
const VISIBLE_CHIP_MAX = 2

// 'lg'(다음 차 카드) 치수 — 타일 64px·제목 text-head(17/700)·ETA 28px.
// 'md'(기본)는 기존 치수를 그대로 유지한다.
const SIZE_CONFIG = {
  md: {
    shadow: 'shadow-sh-card',
    padding: 'p-3',
    tile: 'w-14 h-14 text-mini-ttl',
    glyph: 14,
    title: 'text-list-nm',
    eta: 'text-eta-num',
  },
  lg: {
    shadow: 'shadow-sh-lift',
    padding: 'p-4',
    tile: 'w-16 h-16 text-label',
    glyph: 16,
    title: 'text-head',
    eta: 'text-eta font-extrabold tracking-tight',
  },
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
  size = 'md',
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  const primaryTone = ETA_TONE_CLASS[eta?.primary?.tone] ?? ETA_TONE_CLASS.default
  const Glyph = MODE_GLYPH[badge?.mode] ?? null
  const sizeCfg = SIZE_CONFIG[size] ?? SIZE_CONFIG.md

  const overflowCount = Math.max(0, chips.length - VISIBLE_CHIP_MAX)
  const visibleChips = overflowCount > 0
    ? [...chips.slice(0, VISIBLE_CHIP_MAX), { label: `+${overflowCount}`, tone: 'neutral' }]
    : chips

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-size={size}
      className={[
        'grid grid-cols-[auto_1fr_auto] items-center gap-3',
        'bg-surface rounded-card text-left',
        sizeCfg.shadow,
        sizeCfg.padding,
        onClick
          ? 'w-full appearance-none pressable cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tj-focus-ring)]'
          : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* 노선 타일 — whitespace-nowrap: "20-1" 같은 하이픈 노선번호가 좁은
          폭에서 "20-"/"1" 두 줄로 꺾이던 문제(D3) 방지. 글리프는 badge.mode가
          있을 때만 그린다 — 색만으로 노선 종류를 구분하지 않는다. */}
      <span
        className={[
          'inline-flex flex-col flex-none items-center justify-center gap-0.5',
          'rounded-tile select-none whitespace-nowrap',
          'font-bold tabular-nums leading-none',
          sizeCfg.tile,
          badge?.bgVar ? '' : 'bg-chip-gray-bg text-chip-gray-fg',
        ].filter(Boolean).join(' ')}
        style={badge?.bgVar ? { backgroundColor: badge.bgVar, color: '#ffffff' } : undefined}
      >
        {Glyph && <Glyph size={sizeCfg.glyph} strokeWidth={2.4} aria-hidden="true" className="opacity-90" />}
        {badge?.label}
      </span>

      {/* 본문: 제목 + 칩 행 */}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <h3
            className={[
              'flex-1 min-w-0 leading-snug line-clamp-2',
              sizeCfg.title,
              muted ? 'text-mute' : 'text-ink',
            ].join(' ')}
          >
            {title}
          </h3>
          {subtitle && (
            // min-w-0 + truncate: 폭이 부족하면 말줄임한다. shrink-0이면 자기 그리드
            // 칸을 뚫고 ETA 열 밑으로 그대로 깔리는 겹침(D2)이 생겼다.
            <span className="min-w-0 truncate text-caption text-mute">{subtitle}</span>
          )}
        </div>

        {sleeping && (
          <div className="flex items-center gap-1 text-meta font-bold text-mute">
            <Moon size={12} aria-hidden="true" className="shrink-0" />
            <span>Zzz</span>
            {sleeping.label && <span className="font-semibold truncate">· {sleeping.label}</span>}
          </div>
        )}

        {visibleChips.length > 0 && (
          // overflow-hidden(줄바꿈 없음) — 폭이 좁아지면 칩이 잘려 숨고, title의
          // line-clamp-2 두 줄 공간은 그대로 보장된다.
          <div className="flex items-center gap-1 overflow-hidden">
            {visibleChips.map((chip, i) => (
              <span
                key={`${chip.label}-${i}`}
                className={[
                  'inline-flex items-center gap-1 shrink-0 rounded-full px-1.5 py-px',
                  'text-meta font-semibold leading-none whitespace-nowrap select-none',
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
              // muted는 "현재 도착 정보 없음" 같은 상태 문장 — 숫자 ETA처럼 크게
              // 키우지 않고 줄바꿈을 허용해 좁은 폭에서도 카드 밖으로 안 나가게 한다.
              ? 'text-label font-semibold leading-tight break-keep text-right max-w-[150px]'
              // 상대시간 — 기본은 text-eta-num(22px/800/tabular), size='lg'는 더 크게.
              : sizeCfg.eta,
            'tabular-nums',
            primaryTone,
          ].join(' ')}
        >
          {eta?.primary?.text}
        </span>
        {/* 절대시각/보조 정보 — 상대시간 아래 작게. tabular-nums로 자릿수 흔들림 방지. */}
        <span className="text-caption text-mute tabular-nums leading-none">
          {eta?.secondary?.text ?? ' '}
        </span>
      </div>
    </Tag>
  )
}
