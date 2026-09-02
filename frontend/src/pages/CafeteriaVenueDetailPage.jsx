/**
 * CafeteriaVenueDetailPage — /cafeteria/:venueId 상세 페이지
 *
 * 디자인 규칙:
 *   - 좌측 색상 테두리 없음, 정보 이모지 없음 (lucide OK)
 *   - 글자 >= 13px, 타이포는 인라인 fontSize 대신 text-* 토큰(text-title/head/
 *     list-nm/body/label/caption)을 쓴다 — 접근성 글자 크기 슬라이더
 *     (--tj-font-scale)가 이 토큰 계열에만 반응한다.
 *   - 다크모드 정상 지원
 *   - 터치 영역 >= 44px
 *   - PC에서 RouteDetailPage와 같은 tj-page-w(최대 1120px, 좌측 기준선 고정)로
 *     폭을 제한한다 — 이전에는 반응형 처리가 없어 1900px 모니터에서 본문이
 *     통짜로 늘어났다.
 *   - 운영시간 표는 오늘 요일 행만 액센트 배경으로 강조한다.
 */
import { createElement, useMemo } from 'react'
import { ChevronLeft, Clock } from 'lucide-react'
import { ALL_VENUES } from '../data/cafeteriaVenues'
import {
  isOpenNow,
  getCategoryIcon,
  getCategoryStyle,
  getVenueLocation,
  getBuildingColor,
  getVenueBuilding,
} from '../utils/venueOpen'
import EmptyState from '../components/ui/EmptyState'
import IconButton from '../components/ui/IconButton'

// ── 요일 한국어 라벨 ─────────────────────────────────────────
const PERIOD_LABELS = { semester: '학기', vacation: '방학' }
const DAY_LABELS = { weekday: '평일', saturday: '토요일', sunday: '일요일' }
const CLOSED_DAY_KO = {
  sunday: '일요일',
  saturday: '토요일',
  monday: '월요일',
  tuesday: '화요일',
  wednesday: '수요일',
  thursday: '목요일',
  friday: '금요일',
  holiday: '공휴일',
}

// ── 오늘이 스케줄 표의 어느 요일 키(weekday/saturday/sunday)에 해당하는지 ──
// venueOpen.js의 KST 판정과 같은 방식(Intl + Asia/Seoul 고정)을 쓴다 — 실행
// 환경의 로컬 타임존에 기대지 않는다.
const TODAY_WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul',
  weekday: 'short',
})
function getTodayScheduleKey(now = new Date()) {
  const wd = TODAY_WEEKDAY_FMT.format(now)
  if (wd === 'Sun') return 'sunday'
  if (wd === 'Sat') return 'saturday'
  return 'weekday'
}

// ── 영업 상태 색상 ────────────────────────────────────────────
function statusColor(status) {
  if (status === 'open' || status === 'always') return 'var(--tj-ease)'
  if (status === 'closing') return 'var(--tj-imminent)'
  return 'var(--tj-mute)'
}

// ── 요일별 시간표 그룹 ──────────────────────────────────────
function DayScheduleGroup({ dayLabel, slots, isToday, isLast }) {
  const isEmpty = !slots || slots.length === 0

  return (
    <div
      className={[
        'flex gap-3 py-[11px] items-start',
        isLast ? '' : 'border-b border-line',
        // 오늘 행 강조 — 컨테이너 좌우 패딩(16px)만큼 배경을 바깥으로 밀어
        // 카드 가장자리까지 꽉 채운 액센트 바처럼 보이게 한다.
        isToday ? '-mx-4 px-4 bg-accent-bg rounded-tile' : '',
      ].join(' ')}
    >
      {/* 요일 라벨 */}
      <span className="flex-none w-11 text-caption font-extrabold text-ink-2 pt-px tracking-[-0.01em]">
        {dayLabel}
        {isToday && <span className="sr-only"> · 오늘</span>}
      </span>

      {/* 슬롯 목록 또는 미운영 */}
      <div className="flex-1 min-w-0">
        {isEmpty ? (
          <span className="text-body-sm font-semibold text-mute">운영 안 함</span>
        ) : (
          slots.map((slot, i) => (
            <div
              key={`${slot.type ?? 'op'}-${i}`}
              className="flex items-center gap-2"
              style={{ marginBottom: i < slots.length - 1 ? 5 : 0 }}
            >
              {slot.type && slot.type !== '운영' && (
                <span className="text-caption font-bold text-ink-2 tracking-[-0.01em]">
                  {slot.type}
                </span>
              )}
              <span className="text-list-nm text-ink tabular-nums tracking-[-0.01em]">
                {slot.start} ~ {slot.end}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── 학기/방학 시간표 섹션 ────────────────────────────────────
function PeriodScheduleSection({ periodLabel, periodSchedule, todayKey }) {
  if (!periodSchedule) return null

  const days = [
    { key: 'weekday', label: DAY_LABELS.weekday },
    { key: 'saturday', label: DAY_LABELS.saturday },
    { key: 'sunday', label: DAY_LABELS.sunday },
  ]

  return (
    <div className="bg-surface border border-line rounded-tile px-4 mb-3">
      {/* 섹션 헤더 */}
      <div className="py-3 border-b border-line mb-0.5">
        <span className="text-body-sm font-extrabold text-ink tracking-[-0.02em]">
          {periodLabel}
        </span>
      </div>

      {/* 요일별 행 */}
      {days.map((day, i) => (
        <DayScheduleGroup
          key={day.key}
          dayLabel={day.label}
          slots={periodSchedule[day.key] ?? []}
          isToday={day.key === todayKey}
          isLast={i === days.length - 1}
        />
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export default function CafeteriaVenueDetailPage({ venueId }) {
  const venue = useMemo(
    () => ALL_VENUES.find((v) => v.id === venueId) ?? null,
    [venueId]
  )

  if (!venue) {
    return (
      <div className="flex flex-col h-full bg-surface">
        <header className="flex items-center gap-2.5 px-4 pt-[18px] pb-[13px] bg-surface border-b border-line">
          <IconButton label="뒤로" variant="surface" onClick={() => window.history.back()}>
            <ChevronLeft size={20} />
          </IconButton>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState title="매점 정보를 찾을 수 없어요" desc="잘못된 주소이거나 삭제된 매점이에요." />
        </div>
      </div>
    )
  }

  const statusInfo = isOpenNow(venue, new Date())
  const { status, primaryLabel, subLabel, currentPart } = statusInfo

  const Icon = getCategoryIcon(venue.category)
  const { color: catColor, bg: catBg } = getCategoryStyle(venue.category)
  const building = getVenueBuilding(venue.location ?? getVenueLocation(venue.building, venue.floor))
  const { color: bldColor, bg: bldBg } = getBuildingColor(building)
  const locationStr = venue.location ?? getVenueLocation(venue.building, venue.floor)
  // Intl 포맷 호출 하나뿐이라 memo 없이 매 렌더 계산해도 비용이 없다 — early
  // return(venue 없음) 뒤에 있는 이 지점에서 useMemo를 쓰면 Rules of Hooks
  // 위반(조건부 훅 호출)이 된다.
  const todayKey = getTodayScheduleKey(new Date())

  // closedDays → 한국어 라벨
  const closedDayLabels = (venue.closedDays ?? [])
    .map((d) => CLOSED_DAY_KO[d] ?? d)

  function handleBack() {
    window.history.back()
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--tj-bg)',
      }}
    >
      {/* ── 헤더 ── */}
      <header className="flex-shrink-0 flex items-center gap-[11px] px-4 pt-[18px] pb-[13px] bg-surface border-b border-line">
        <IconButton label="뒤로" variant="surface" onClick={handleBack}>
          <ChevronLeft size={20} />
        </IconButton>

        {/* 카테고리 아이콘 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: catBg }}
        >
          {createElement(Icon, { size: 18, strokeWidth: 2, color: catColor })}
        </div>

        {/* 이름 + 위치 */}
        <div className="flex-1 min-w-0">
          <div className="text-title font-black text-ink leading-tight tracking-[-0.03em]">
            {venue.name}
          </div>
          <div className="mt-1">
            <span
              className="inline-block text-caption font-bold rounded-badge px-[7px] py-[2px] leading-[1.5] tracking-[-0.01em]"
              style={{ color: bldColor, background: bldBg }}
            >
              {locationStr}
            </span>
          </div>
        </div>
      </header>

      {/* ── PC 폭 제한: RouteDetailPage와 같은 tj-page-w 관례(최대 1120px, 좌측
          기준선 유지) — 넓은 모니터에서 본문이 통짜로 늘어나는 것을 막는다. ── */}
      <div className="flex-1 overflow-hidden flex flex-col tj-page-w">
        {/* ── 바디 (스크롤 가능) — 하단 padding(112px)은 모바일 FloatingDock을
            피하는 여백이라 테스트가 이 정확한 인라인 값을 검증한다. ── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 16px 112px',
          }}
        >
          {/* 현재 영업 상태 카드 */}
          <div className="bg-surface border border-line rounded-tile px-4 py-[14px] mb-4 flex items-center gap-2.5">
            <Clock size={18} color="var(--tj-mute)" strokeWidth={2} />
            <div>
              <div
                className="text-list-nm font-extrabold tracking-[-0.01em]"
                style={{ color: statusColor(status) }}
              >
                {/* 24h 이면 24시간 영업, 아니면 영업중/영업전/영업종료 등 */}
                {venue.is24h || venue.alwaysOpen ? '24시간 영업' : primaryLabel}
                {currentPart?.type && status !== 'always' && (
                  <span className="ml-1.5 text-caption font-bold text-mute">
                    {currentPart.type}
                  </span>
                )}
              </div>
              {subLabel && (
                <div className="mt-0.5 text-caption font-semibold text-mute tracking-[-0.01em]">
                  {subLabel}
                </div>
              )}
            </div>
          </div>

          {/* ── 시간표 (학기/방학) ── */}
          {!venue.is24h && !venue.alwaysOpen && venue.schedule && (
            <div className="mb-4">
              <div className="text-body-sm font-extrabold text-ink tracking-[-0.02em] mb-2.5">
                운영 시간
              </div>

              {Object.entries(PERIOD_LABELS).map(([periodKey, periodLabel]) => {
                const periodSchedule = venue.schedule[periodKey]
                return (
                  <PeriodScheduleSection
                    key={periodKey}
                    periodLabel={periodLabel}
                    periodSchedule={periodSchedule}
                    todayKey={todayKey}
                  />
                )
              })}
            </div>
          )}

          {/* 24시간 영업 안내 */}
          {(venue.is24h || venue.alwaysOpen) && (
            <div className="bg-surface border border-line rounded-tile px-4 py-[14px] mb-4 text-list-nm text-ease tracking-[-0.01em]">
              24시간 연중무휴 운영해요
            </div>
          )}

          {/* ── 메뉴 ── */}
          {venue.menu && venue.menu.length > 0 && (
            <div className="mb-4">
              <div className="text-body-sm font-extrabold text-ink tracking-[-0.02em] mb-2.5">
                주요 메뉴
              </div>
              <div className="bg-surface border border-line rounded-tile px-4 py-1">
                {venue.menu.map((item, i) => (
                  <div
                    key={`${item}-${i}`}
                    className={[
                      'py-[10px] text-label font-semibold text-ink tracking-[-0.01em]',
                      i < venue.menu.length - 1 ? 'border-b border-line' : '',
                    ].join(' ')}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 휴무 / 참고 ── */}
          {(closedDayLabels.length > 0 || venue.closedNote || venue.note) && (
            <div className="bg-surface border border-line rounded-tile px-4 py-[14px] mb-4 flex flex-col gap-2">
              {(closedDayLabels.length > 0 || venue.closedNote) && (
                <div className="flex items-baseline gap-2">
                  <span className="flex-shrink-0 text-caption font-extrabold text-ink-2 tracking-[-0.01em]">
                    휴무
                  </span>
                  <span className="text-body-sm font-semibold text-mute tracking-[-0.01em]">
                    {venue.closedNote
                      ? venue.closedNote
                      : closedDayLabels.join(' · ')}
                  </span>
                </div>
              )}

              {venue.note && (
                <div className="flex items-baseline gap-2">
                  <span className="flex-shrink-0 text-caption font-extrabold text-ink-2 tracking-[-0.01em]">
                    참고
                  </span>
                  <span className="text-body-sm font-semibold text-mute tracking-[-0.01em]">
                    {venue.note}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
