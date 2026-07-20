/**
 * CafeteriaVenueDetailPage — /cafeteria/:venueId 상세 페이지
 *
 * 디자인 규칙:
 *   - 좌측 색상 테두리 없음, 정보 이모지 없음 (lucide OK)
 *   - 글자 >= 13px
 *   - 다크모드 정상 지원
 *   - 터치 영역 >= 44px
 */
import { useMemo } from 'react'
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

// ── 영업 상태 색상 ────────────────────────────────────────────
function statusColor(status) {
  if (status === 'open' || status === 'always') return 'var(--tj-ease)'
  if (status === 'closing') return 'var(--tj-imminent)'
  return 'var(--tj-mute)'
}

// ── 시간표 슬롯 행 ──────────────────────────────────────────
function SlotRow({ slot, isLast }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--tj-line)',
      }}
    >
      <span
        style={{
          flex: 'none',
          minWidth: 44,
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--tj-ink-2)',
          letterSpacing: '-0.01em',
        }}
      >
        {slot.type ?? '운영'}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--tj-ink)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.01em',
        }}
      >
        {slot.start} ~ {slot.end}
      </span>
    </div>
  )
}

// ── 요일별 시간표 그룹 ──────────────────────────────────────
function DayScheduleGroup({ dayLabel, slots }) {
  const isEmpty = !slots || slots.length === 0

  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '11px 0',
        borderBottom: '1px solid var(--tj-line)',
        alignItems: 'flex-start',
      }}
    >
      {/* 요일 라벨 */}
      <span
        style={{
          flex: 'none',
          width: 44,
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--tj-ink-2)',
          paddingTop: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {dayLabel}
      </span>

      {/* 슬롯 목록 또는 미운영 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {isEmpty ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--tj-mute)' }}>
            운영 안 함
          </span>
        ) : (
          slots.map((slot, i) => (
            <div
              key={`${slot.type ?? 'op'}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: i < slots.length - 1 ? 5 : 0,
              }}
            >
              {slot.type && slot.type !== '운영' && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--tj-ink-2)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {slot.type}
                </span>
              )}
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--tj-ink)',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.01em',
                }}
              >
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
function PeriodScheduleSection({ periodLabel, periodSchedule }) {
  if (!periodSchedule) return null

  const days = [
    { key: 'weekday', label: DAY_LABELS.weekday },
    { key: 'saturday', label: DAY_LABELS.saturday },
    { key: 'sunday', label: DAY_LABELS.sunday },
  ]

  return (
    <div
      style={{
        background: 'var(--tj-surface)',
        border: '1px solid var(--tj-line)',
        borderRadius: 16,
        padding: '0 16px',
        marginBottom: 12,
      }}
    >
      {/* 섹션 헤더 */}
      <div
        style={{
          padding: '12px 0 10px',
          borderBottom: '1px solid var(--tj-line)',
          marginBottom: 2,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: 'var(--tj-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          {periodLabel}
        </span>
      </div>

      {/* 요일별 행 */}
      {days.map((day, i) => {
        const slots = periodSchedule[day.key] ?? []
        const isLast = i === days.length - 1
        return (
          <div
            key={day.key}
            style={{ borderBottom: isLast ? 'none' : undefined }}
          >
            <DayScheduleGroup
              dayLabel={day.label}
              slots={slots}
            />
          </div>
        )
      })}
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
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '18px 16px 13px',
            background: 'var(--tj-surface)',
            borderBottom: '1px solid var(--tj-line)',
          }}
        >
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => window.history.back()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--tj-surface-2)',
              border: '1px solid var(--tj-line)',
              color: 'var(--tj-ink-2)',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={20} />
          </button>
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
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '18px 16px 13px',
          background: 'var(--tj-surface)',
          borderBottom: '1px solid var(--tj-line)',
        }}
      >
        <button
          type="button"
          aria-label="뒤로"
          onClick={handleBack}
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--tj-surface-2)',
            border: '1px solid var(--tj-line)',
            color: 'var(--tj-ink-2)',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* 카테고리 아이콘 */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: catBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={2} color={catColor} />
        </div>

        {/* 이름 + 위치 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: '-0.03em',
              color: 'var(--tj-ink)',
              lineHeight: 1.2,
            }}
          >
            {venue.name}
          </div>
          <div style={{ marginTop: 4 }}>
            <span
              style={{
                display: 'inline-block',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: bldColor,
                background: bldBg,
                borderRadius: 6,
                padding: '2px 7px',
                lineHeight: 1.5,
              }}
            >
              {locationStr}
            </span>
          </div>
        </div>
      </header>

      {/* ── 바디 (스크롤 가능) ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 16px 112px',
        }}
      >
        {/* 현재 영업 상태 카드 */}
        <div
          style={{
            background: 'var(--tj-surface)',
            border: '1px solid var(--tj-line)',
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Clock size={18} color="var(--tj-mute)" strokeWidth={2} />
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: statusColor(status),
                letterSpacing: '-0.01em',
              }}
            >
              {/* 24h 이면 24시간 영업, 아니면 영업중/영업전/영업종료 등 */}
              {venue.is24h || venue.alwaysOpen ? '24시간 영업' : primaryLabel}
              {currentPart?.type && status !== 'always' && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--tj-mute)',
                  }}
                >
                  {currentPart.type}
                </span>
              )}
            </div>
            {subLabel && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--tj-mute)',
                  marginTop: 2,
                  letterSpacing: '-0.01em',
                }}
              >
                {subLabel}
              </div>
            )}
          </div>
        </div>

        {/* ── 시간표 (학기/방학) ── */}
        {!venue.is24h && !venue.alwaysOpen && venue.schedule && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--tj-ink)',
                letterSpacing: '-0.02em',
                marginBottom: 10,
              }}
            >
              운영 시간
            </div>

            {Object.entries(PERIOD_LABELS).map(([periodKey, periodLabel]) => {
              const periodSchedule = venue.schedule[periodKey]
              return (
                <PeriodScheduleSection
                  key={periodKey}
                  periodLabel={periodLabel}
                  periodSchedule={periodSchedule}
                />
              )
            })}
          </div>
        )}

        {/* 24시간 영업 안내 */}
        {(venue.is24h || venue.alwaysOpen) && (
          <div
            style={{
              background: 'var(--tj-surface)',
              border: '1px solid var(--tj-line)',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--tj-ease)',
              letterSpacing: '-0.01em',
            }}
          >
            24시간 연중무휴 운영해요
          </div>
        )}

        {/* ── 메뉴 ── */}
        {venue.menu && venue.menu.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--tj-ink)',
                letterSpacing: '-0.02em',
                marginBottom: 10,
              }}
            >
              주요 메뉴
            </div>
            <div
              style={{
                background: 'var(--tj-surface)',
                border: '1px solid var(--tj-line)',
                borderRadius: 16,
                padding: '4px 16px',
              }}
            >
              {venue.menu.map((item, i) => (
                <div
                  key={`${item}-${i}`}
                  style={{
                    padding: '10px 0',
                    borderBottom: i < venue.menu.length - 1 ? '1px solid var(--tj-line)' : 'none',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--tj-ink)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 휴무 / 참고 ── */}
        {(closedDayLabels.length > 0 || venue.closedNote || venue.note) && (
          <div
            style={{
              background: 'var(--tj-surface)',
              border: '1px solid var(--tj-line)',
              borderRadius: 16,
              padding: '14px 16px',
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {(closedDayLabels.length > 0 || venue.closedNote) && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--tj-ink-2)',
                    flexShrink: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  휴무
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--tj-mute)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {venue.closedNote
                    ? venue.closedNote
                    : closedDayLabels.join(' · ')}
                </span>
              </div>
            )}

            {venue.note && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--tj-ink-2)',
                    flexShrink: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  참고
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--tj-mute)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {venue.note}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
