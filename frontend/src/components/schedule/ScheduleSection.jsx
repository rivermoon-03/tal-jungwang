/**
 * ScheduleSection — 시간표 목록의 한 행.
 *
 * 해부도는 정본 TransitCard 하나를 쓴다. 예전에는 이 파일이 [시간열 56px]
 * [본문][★] 그리드를 직접 그렸다. 같은 앱의 홈 요약과 노선 상세는 ETA 가
 * 오른쪽인데 여기만 왼쪽이라, 한 앱 안에서 두 가지 훑기 습관을 들이게 했다.
 * 56px 고정 폭 때문에 "8시간 4분" 같은 문자열이 두 줄로 꺾이는 문제도 이
 * 열의 성질이었다.
 *
 * 버스(실시간/시간표)·지하철·셔틀 세 모드가 이 컴포넌트 하나를 쓴다. 행 클릭은
 * 항상 onClick 콜백만 부르고 라우팅은 호출부(SchedulePage)가 데스크톱/모바일
 * 분기로 결정한다 — 카드가 스스로 pushState 하면 PC master-detail 이 깨진다.
 */
import { Star } from 'lucide-react'
import TransitCard from '../ui/TransitCard'
import { SkeletonArrivalCard } from '../common/Skeleton'
import IconButton from '../ui/IconButton'
import { labelFromLevel } from '../../utils/crowdingLevel'
import { scaledPx } from '../../utils/fontScale'

/**
 * 행이 지금 무엇을 말해야 하는지 정해 TransitCard 의 eta 프롭으로 옮긴다.
 *
 * timeLines 는 "주말"/"미운행" 처럼 숫자가 아닌 상태 문구다. 56px 열에 맞추려고
 * 두 줄로 쪼개 쓰던 것이라, 폭 제약이 사라진 지금은 한 줄로 합쳐 넘긴다.
 */
function buildEta({ timeLines, minutesUntil, hhmm, imminent }) {
  if (timeLines?.length) {
    return { primary: { text: timeLines.join(' '), tone: 'muted' } }
  }
  if (minutesUntil == null && !imminent) {
    return { primary: { text: '정보 없음', tone: 'muted' } }
  }
  if (imminent) {
    return { primary: { text: '곧', tone: 'imminent' }, secondary: hhmm ? { text: hhmm } : undefined }
  }
  // eta.js(정본)와 같은 규칙: 60분 초과는 상대 분 대신 절대 시각으로 보여준다.
  if (minutesUntil > 60 && hhmm) {
    return { primary: { text: hhmm, tone: 'default' } }
  }
  return {
    primary: { text: `${minutesUntil}분`, tone: 'default' },
    secondary: hhmm ? { text: hhmm } : undefined,
  }
}

export default function ScheduleSection({
  type = 'bus',
  routeCode,
  title,
  liveChip = false,
  timetableChip = false,
  crowded = 0,
  lastBus = false,
  testBadge = false,
  subtitle = null,
  boldPrefix = null,
  timeLines = null,
  // 지금이 운행 시간대 밖일 때(막차 이후·첫차 이전) 노선명 아래에 붙는 한 줄.
  sleeping = false,
  sleepingLabel = null,
  minutesUntil = null,
  hhmm = null,
  imminent = false,
  disabled = false,
  disabledLabel = null,
  isFavorite = false,
  onToggleFavorite = null,
  onClick = null,
  selected = false,
  loading = false,
  footer = null,
}) {
  if (loading) return <SkeletonArrivalCard />

  const badgeRoute = routeCode || (type === 'shuttle' ? '셔틀' : title)
  const crowdedLabel = !disabled && crowded > 0 ? labelFromLevel(crowded) : null

  // 칩 순서는 TransitCard 규격을 따른다 — 실시간 → 혼잡 → 나머지.
  // 두 개를 넘으면 TransitCard 가 "+N" 으로 접고 접힌 라벨을 이름으로 남긴다.
  const chips = []
  if (!disabled && liveChip) chips.push({ label: '실시간', tone: 'realtime' })
  if (!disabled && timetableChip) chips.push({ label: '시간표', tone: 'neutral' })
  if (crowdedLabel) chips.push({ label: crowdedLabel, tone: crowded >= 3 ? 'warn' : 'neutral' })
  if (!disabled && lastBus) chips.push({ label: '막차', tone: 'warn' })
  if (!disabled && testBadge) chips.push({ label: '베타', tone: 'beta' })

  const descriptionText = disabled ? disabledLabel : subtitle
  const description = descriptionText ? (
    <p
      style={{ fontSize: scaledPx(12.5), color: 'var(--tj-mute)', fontWeight: 500, lineHeight: 1.4, margin: 0 }}
    >
      {!disabled && boldPrefix && (
        <b style={{ color: 'var(--tj-ink-2)', fontWeight: 800 }} className="dark:text-ink-2">
          {boldPrefix}
        </b>
      )}
      {descriptionText}
    </p>
  ) : null

  return (
    <TransitCard
      badge={{ label: badgeRoute, mode: type }}
      title={title}
      chips={chips}
      eta={buildEta({ timeLines, minutesUntil, hhmm, imminent })}
      muted={disabled}
      sleeping={sleeping ? { label: sleepingLabel } : null}
      description={description}
      footer={!disabled && footer ? footer : null}
      selected={selected}
      onClick={!disabled && onClick ? onClick : undefined}
      rightAddon={
        onToggleFavorite ? (
          <IconButton
            onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
            label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            variant="ghost"
          >
            <Star
              size={18}
              fill={isFavorite ? 'var(--tj-imminent)' : 'none'}
              style={{ color: isFavorite ? 'var(--tj-imminent)' : 'var(--tj-mute)' }}
            />
          </IconButton>
        ) : null
      }
    />
  )
}
