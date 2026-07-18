/**
 * CafeteriaVenues.jsx — 학식 운영 정보 컴포넌트
 *
 * 탭 구조:
 *   [지금 영업중 | 운영시간] — 기본 "지금 영업중"
 *
 * 시안1: 식당별 조/중/석 + 운영중 배지 (운영시간 탭)
 * 시안2: 현재 시각 기준 영업중 필터 목록 (지금 영업중 탭, 기본)
 *
 * 디자인 규칙:
 *   - 좌측 색상 테두리 없음, 이모지 없음
 *   - 영업중/마감임박: 텍스트 + 의미색 (점 없음)
 *   - 본문 글자 >= 15px (text-body)
 *   - 다크모드 정상 지원
 */
import { useMemo, useState } from 'react'
import { Star, StarOff } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import useAppStore from '../../stores/useAppStore'
import { ALL_VENUES, RESTAURANTS, VENUE_GROUPS, BUILDING_GROUPS, CATEGORY_GROUPS } from '../../data/cafeteriaVenues'
import { isOpenNow, getVenueBuilding, getBuildingColor, getCategoryStyle, getCategoryIcon } from '../../utils/venueOpen'
import SegmentTabs from '../ui/SegmentTabs'
import { staggerStyle } from '../../utils/motion'
import './CafeteriaVenues.css'

// ── 탭 정의 ────────────────────────────────────────────────
const TABS = [
  { id: 'now',      label: '지금' },
  { id: 'schedule', label: '운영시간' },
]

// ── 정렬 스위치 정의 ────────────────────────────────────────
const SORT_OPTIONS = [
  { id: 'building',  label: '장소별' },
  { id: 'category',  label: '카테고리별' },
]

// ── KST 기준 현재 요일/시각 표시 헬퍼 ───────────────────────
const KST_FMT_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const KST_FMT_WEEKDAY = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  weekday: 'long',
})

function kstTime(nowMs) {
  const d = new Date(nowMs)
  return KST_FMT_TIME.format(d)
}
function kstWeekday(nowMs) {
  return KST_FMT_WEEKDAY.format(new Date(nowMs))
}

// ── 카테고리 아이콘 원형 칩 ──────────────────────────────────
function CategoryIconChip({ category }) {
  const { color, bg } = getCategoryStyle(category)
  const Icon = getCategoryIcon(category)
  return (
    <div
      style={{
        flex: 'none',
        width: 40,
        height: 40,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={18} strokeWidth={2} color={color} />
    </div>
  )
}

// ── 건물별 위치 칩 ────────────────────────────────────────
function LocationChip({ location }) {
  const building = getVenueBuilding(location)
  const { color, bg } = getBuildingColor(building)
  return (
    <span
      style={{
        display: 'inline-block',
        flexShrink: 0,
        // "TIP 1F"가 "TIP / 1F"로 줄바꿈되던 문제 — 위치 라벨은 항상 한 줄.
        whiteSpace: 'nowrap',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color,
        background: bg,
        borderRadius: 6,
        padding: '2px 7px',
        lineHeight: 1.5,
      }}
    >
      {location}
    </span>
  )
}

// ── 상태 배지 (시안 TO-BE) ─────────────────────────────────
// 종료/휴무를 회색 텍스트가 아니라 톤다운 적색 배지로 보여 "운영 중"(초록)과
// 시각 대비를 준다. 색/다크대응은 CafeteriaVenues.css.
function StatusPill({ primaryLabel, status }) {
  const cls =
    status === 'open' || status === 'always'
      ? 'is-open'
      : status === 'closing'
        ? 'is-closing'
        : 'is-closed' // closed_day / after_close / before_open
  return (
    <span className={`cafe-status-pill ${cls}`}>
      <span className="dot" />
      {primaryLabel}
    </span>
  )
}

// ── F2: 매점/식당 즐겨찾기 별 버튼 (카드 변형 3종 공통) ────────────
function FavoriteStarButton({ venueId, size = 15 }) {
  const isFav = useAppStore(
    (s) => Array.isArray(s.favorites?.venues) && s.favorites.venues.includes(venueId)
  )
  const toggleFavoriteVenue = useAppStore((s) => s.toggleFavoriteVenue)

  return (
    <button
      type="button"
      aria-label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-pressed={isFav}
      className="pressable"
      onClick={(e) => {
        // 카드 자체도 클릭 가능(role=button)하므로 버블링으로 상세 이동이
        // 함께 트리거되지 않도록 막는다.
        e.stopPropagation()
        if (typeof toggleFavoriteVenue === 'function') toggleFavoriteVenue(venueId)
      }}
      style={{
        flex: 'none',
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '1px solid var(--tj-line)',
        background: isFav ? '#FBF4E5' : 'var(--tj-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: isFav ? '#C2902E' : 'var(--tj-mute)',
        touchAction: 'manipulation',
      }}
    >
      {isFav
        ? <Star size={size} strokeWidth={2} fill="currentColor" />
        : <StarOff size={size} strokeWidth={2} />
      }
    </button>
  )
}

// ── 시안1: 운영시간 탭 ────────────────────────────────────────

/** 학식(meals 구조) 카드 */
function RestaurantCard({ venue, nowDate, onVenueClick }) {
  const statusInfo = isOpenNow(venue, nowDate)
  const { status, primaryLabel, subLabel } = statusInfo

  return (
    <div
      role="button"
      aria-label={venue.name}
      tabIndex={0}
      onClick={() => onVenueClick(venue.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onVenueClick(venue.id) }}
      style={{
        background: 'var(--tj-surface)',
        border: '1px solid var(--tj-line)',
        borderRadius: 18,
        padding: '15px 16px',
        marginBottom: 10,
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {/* 헤더: 아이콘 + 이름 + 상태 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <CategoryIconChip category={venue.category} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--tj-ink)' }}>
              {venue.name}
            </div>
            <div style={{ marginTop: 4 }}>
              <LocationChip location={venue.location} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <StatusPill primaryLabel={primaryLabel} status={status} />
            {subLabel && (
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tj-mute)', marginTop: 2, letterSpacing: '-0.01em' }}>
                {subLabel}
              </div>
            )}
          </div>
          <FavoriteStarButton venueId={venue.id} />
        </div>
      </div>

      {/* 끼니별 시간표 — meals 없으면 schedule.semester.weekday 폴백 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {(venue.meals ?? venue.schedule?.semester?.weekday ?? []).map((meal) => {
          const mealOpen = isOpenNow({ meals: [meal], closedDays: [] }, nowDate)
          const isLive = mealOpen.open
          return (
            <div
              key={meal.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 15,
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{ flex: 'none', width: 38, fontSize: 13, fontWeight: 700, color: 'var(--tj-ink-2)' }}>
                {meal.type}
              </span>
              <span
                style={{
                  fontWeight: isLive ? 800 : 600,
                  color: isLive ? 'var(--tj-ease)' : 'var(--tj-ink)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {meal.start} ~ {meal.end}
              </span>
              {isLive && (
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--tj-ease)' }}>
                  지금 운영 중
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 대표 메뉴 (시안 TO-BE) — 있을 때만, 본문 글자 크기로 강조 */}
      {Array.isArray(venue.menu) && venue.menu.length > 0 && (
        <div
          style={{
            marginTop: 11,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--tj-ink)',
            lineHeight: 1.6,
            letterSpacing: '-0.01em',
          }}
        >
          {venue.menu.join(' · ')}
        </div>
      )}

      {/* 풋터: note + 휴무 */}
      {(venue.note || venue.closedNote || venue.closedDays?.length > 0) && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 11,
            borderTop: '1px dashed var(--tj-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 13,
            color: 'var(--tj-ink-2)',
            fontWeight: 600,
          }}
        >
          {venue.note && (
            <>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: 'var(--tj-accent-ink)',
                  background: 'var(--tj-accent-bg)',
                  borderRadius: 8,
                  padding: '3px 8px',
                  letterSpacing: '-0.01em',
                }}
              >
                {venue.note}
              </span>
              <span>조식 운영해요</span>
            </>
          )}
          {(venue.closedNote || venue.closedDays?.length > 0) && (
            <span style={{ marginLeft: 'auto', color: 'var(--tj-mute)', fontWeight: 600 }}>
              {venue.closedNote ?? (venue.closedDays.includes('sunday') ? '일요일 휴무' : '주말 휴무')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/** 단순 시간대(hours) 카드 — 푸드코트/기타/카페 */
function SimpleVenueCard({ venue, nowDate, onVenueClick }) {
  const { status, primaryLabel, subLabel } = isOpenNow(venue, nowDate)

  // 대표 시간 표기 — hours 없으면 schedule.semester.weekday 폴백
  const timeLabel = (venue.alwaysOpen || venue.is24h)
    ? '24시간'
    : (venue.hours ?? venue.schedule?.semester?.weekday ?? [])
        .map((h) => `${h.start} ~ ${h.end}`).join(', ')

  return (
    <div
      role="button"
      aria-label={venue.name}
      tabIndex={0}
      onClick={() => onVenueClick(venue.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onVenueClick(venue.id) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 0',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {/* 카테고리 아이콘 칩 */}
      <CategoryIconChip category={venue.category} />

      {/* 이름 + 위치 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--tj-ink)' }}>
          {venue.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
          <LocationChip location={venue.location} />
          <span style={{ fontSize: 13, color: 'var(--tj-mute)', fontWeight: 600, letterSpacing: '-0.01em' }}>
            {timeLabel}
            {venue.closedNote && ` · ${venue.closedNote}`}
          </span>
        </div>
      </div>

      {/* 상태 */}
      <div style={{ flex: 'none', textAlign: 'right' }}>
        <StatusPill primaryLabel={primaryLabel} status={status} />
        {subLabel && (
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tj-mute)', marginTop: 2, letterSpacing: '-0.01em' }}>
            {subLabel}
          </div>
        )}
      </div>

      {/* 즐겨찾기 */}
      <FavoriteStarButton venueId={venue.id} />
    </div>
  )
}

// ── 그룹 헤더 — 건물별 ──────────────────────────────────────
function BuildingGroupHeader({ building }) {
  const { color, bg } = getBuildingColor(building)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color,
          background: bg,
          borderRadius: 8,
          padding: '3px 10px',
        }}
      >
        {building}
      </span>
      <span style={{ flex: 1, height: 1, background: 'var(--tj-line)' }} />
    </div>
  )
}

// ── 그룹 헤더 — 카테고리별 ──────────────────────────────────
function CategoryGroupHeader({ category }) {
  const Icon = getCategoryIcon(category)
  const { color, bg } = getCategoryStyle(category)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: bg,
          borderRadius: 8,
          padding: '3px 10px',
        }}
      >
        <Icon size={14} strokeWidth={2.2} color={color} />
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em', color }}>
          {category}
        </span>
      </div>
      <span style={{ flex: 1, height: 1, background: 'var(--tj-line)' }} />
    </div>
  )
}

// ── 그룹 내 venue 리스트 렌더 (슬림 카드, 공통) ──────────────
function VenueSlimList({ venues, nowDate, onVenueClick }) {
  return (
    <div
      style={{
        background: 'var(--tj-surface)',
        border: '1px solid var(--tj-line)',
        borderRadius: 16,
        padding: '0 14px',
      }}
    >
      {venues.map((venue, i) => (
        <div
          key={venue.id}
          className="tj-card-enter"
          style={{
            borderBottom: i < venues.length - 1 ? '1px solid var(--tj-line)' : 'none',
            ...staggerStyle(i),
          }}
        >
          <SimpleVenueCard venue={venue} nowDate={nowDate} onVenueClick={onVenueClick} />
        </div>
      ))}
    </div>
  )
}

/** 운영시간 탭 — 정렬 스위치 적용 */
function ScheduleTab({ sortBy, nowDate, onVenueClick }) {
  // 장소별 (건물 그룹)
  if (sortBy === 'building') {
    return (
      <div>
        {BUILDING_GROUPS.map((group) => {
          const restaurants = group.venues.filter((v) => v.meals)
          const simpleVenues = group.venues.filter((v) => !v.meals)
          return (
            <div key={group.key} style={{ marginBottom: 18 }}>
              <BuildingGroupHeader building={group.label} />
              {/* 학식(meals 구조) — 풀 카드 */}
              {restaurants.map((venue) => (
                <RestaurantCard key={venue.id} venue={venue} nowDate={nowDate} onVenueClick={onVenueClick} />
              ))}
              {/* 단순 시간대 — 슬림 리스트 */}
              {simpleVenues.length > 0 && (
                <VenueSlimList venues={simpleVenues} nowDate={nowDate} onVenueClick={onVenueClick} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // 카테고리별
  return (
    <div>
      {CATEGORY_GROUPS.map((group) => {
        const restaurants = group.venues.filter((v) => v.meals)
        const simpleVenues = group.venues.filter((v) => !v.meals)
        return (
          <div key={group.key} style={{ marginBottom: 18 }}>
            <CategoryGroupHeader category={group.label} />
            {restaurants.map((venue) => (
              <RestaurantCard key={venue.id} venue={venue} nowDate={nowDate} onVenueClick={onVenueClick} />
            ))}
            {simpleVenues.length > 0 && (
              <VenueSlimList venues={simpleVenues} nowDate={nowDate} onVenueClick={onVenueClick} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 시안2: 지금 영업중 탭 ─────────────────────────────────────

/** 영업중 장소 한 행 */
function OpenRow({ venue, statusInfo, onVenueClick }) {
  const { status, currentPart } = statusInfo

  // 우측 종료 안내: 파트명 있으면 "중식 · 14:00 종료", 없으면 "14:00 영업 종료"
  const endLabel = currentPart
    ? currentPart.type
      ? `${currentPart.type} · ${currentPart.end} 종료`
      : `${currentPart.end} 영업 종료`
    : null

  return (
    <div
      role="button"
      aria-label={venue.name}
      tabIndex={0}
      onClick={() => onVenueClick(venue.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onVenueClick(venue.id) }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 2px',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {/* 카테고리 아이콘 칩 */}
      <CategoryIconChip category={venue.category} />

      {/* 이름 + 위치 칩 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--tj-ink)' }}>
          {venue.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, minWidth: 0 }}>
          <LocationChip location={venue.location} />
          {(venue.alwaysOpen || venue.is24h) && (
            <span style={{ fontSize: 12, color: 'var(--tj-mute)', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              언제든 열려 있어요
            </span>
          )}
        </div>
      </div>

      {/* 영업 종료 시각 안내 */}
      <div style={{ flex: 'none', textAlign: 'right' }}>
        {(venue.alwaysOpen || venue.is24h) ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tj-accent-ink)' }}>
            24시간 영업
          </span>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: status === 'closing' ? 'var(--tj-imminent)' : 'var(--tj-mute)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {endLabel}
          </span>
        )}
      </div>

      {/* 즐겨찾기 */}
      <FavoriteStarButton venueId={venue.id} />
    </div>
  )
}

/** 지금 영업중 탭 */
function NowOpenTab({ sortBy, nowDate, onVenueClick }) {
  const openVenues = useMemo(() => {
    return ALL_VENUES
      .map((venue) => ({ venue, statusInfo: isOpenNow(venue, nowDate) }))
      .filter(({ statusInfo }) => statusInfo.open)
  }, [nowDate])

  if (openVenues.length === 0) {
    return (
      <div
        style={{
          padding: '40px 16px',
          textAlign: 'center',
          color: 'var(--tj-mute)',
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        지금 영업 중인 곳이 없어요
      </div>
    )
  }

  // 장소별 그룹핑
  if (sortBy === 'building') {
    const buildingMap = {}
    openVenues.forEach(({ venue, statusInfo }) => {
      const b = venue.building ?? getVenueBuilding(venue.location)
      if (!buildingMap[b]) buildingMap[b] = []
      buildingMap[b].push({ venue, statusInfo })
    })
    const buildingOrder = ['TIP', 'E동', '중앙도서관']
    const groups = buildingOrder
      .filter((b) => buildingMap[b]?.length > 0)
      .map((b) => ({ building: b, items: buildingMap[b] }))

    return (
      <div>
        {groups.map((group) => (
          <div key={group.building} style={{ marginBottom: 14 }}>
            <BuildingGroupHeader building={group.building} />
            <div
              style={{
                background: 'var(--tj-surface)',
                border: '1px solid var(--tj-line)',
                borderRadius: 18,
                padding: '0 14px',
                overflow: 'hidden',
              }}
            >
              {group.items.map(({ venue, statusInfo }, i) => (
                <div
                  key={venue.id}
                  style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--tj-line)' : 'none' }}
                >
                  <OpenRow venue={venue} statusInfo={statusInfo} onVenueClick={onVenueClick} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // 카테고리별 그룹핑
  const categoryOrder = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
  const categoryMap = {}
  openVenues.forEach(({ venue, statusInfo }) => {
    const c = venue.category
    if (!categoryMap[c]) categoryMap[c] = []
    categoryMap[c].push({ venue, statusInfo })
  })
  const catGroups = categoryOrder
    .filter((c) => categoryMap[c]?.length > 0)
    .map((c) => ({ category: c, items: categoryMap[c] }))

  // 카테고리별 그룹핑이 없으면 단순 리스트
  if (catGroups.length === 0) {
    return (
      <div
        style={{
          background: 'var(--tj-surface)',
          border: '1px solid var(--tj-line)',
          borderRadius: 18,
          padding: '0 14px',
          overflow: 'hidden',
        }}
      >
        {openVenues.map(({ venue, statusInfo }, i) => (
          <div
            key={venue.id}
            style={{ borderBottom: i < openVenues.length - 1 ? '1px solid var(--tj-line)' : 'none' }}
          >
            <OpenRow venue={venue} statusInfo={statusInfo} onVenueClick={onVenueClick} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {catGroups.map((group) => (
        <div key={group.category} style={{ marginBottom: 14 }}>
          <CategoryGroupHeader category={group.category} />
          <div
            style={{
              background: 'var(--tj-surface)',
              border: '1px solid var(--tj-line)',
              borderRadius: 18,
              padding: '0 14px',
              overflow: 'hidden',
            }}
          >
            {group.items.map(({ venue, statusInfo }, i) => (
              <div
                key={venue.id}
                style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--tj-line)' : 'none' }}
              >
                <OpenRow venue={venue} statusInfo={statusInfo} onVenueClick={onVenueClick} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── F2: 즐겨찾기 · 지금 영업 중 섹션 ───────────────────────────
/** 즐겨찾기한 매점/식당 중 지금 영업 중인 곳만 상단에 노출.
 * 즐겨찾기가 없거나 전부 닫혀 있으면 섹션 자체를 숨긴다(빈 섹션 금지). */
function FavoriteOpenSection({ nowDate, onVenueClick }) {
  const favoriteVenueIds = useAppStore((s) =>
    Array.isArray(s.favorites?.venues) ? s.favorites.venues : []
  )

  const favoriteOpenItems = useMemo(() => {
    if (!favoriteVenueIds.length) return []
    return ALL_VENUES
      .filter((v) => favoriteVenueIds.includes(v.id))
      .map((venue) => ({ venue, statusInfo: isOpenNow(venue, nowDate) }))
      .filter(({ statusInfo }) => statusInfo.open)
  }, [favoriteVenueIds, nowDate])

  if (favoriteOpenItems.length === 0) return null

  return (
    <div data-testid="favorite-open-section" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: '#C2902E',
            background: '#FBF4E5',
            borderRadius: 8,
            padding: '3px 10px',
          }}
        >
          <Star size={13} strokeWidth={2} fill="currentColor" />
          즐겨찾기 · 지금 영업 중
        </span>
        <span style={{ flex: 1, height: 1, background: 'var(--tj-line)' }} />
      </div>
      <div
        style={{
          background: 'var(--tj-surface)',
          border: '1px solid var(--tj-line)',
          borderRadius: 18,
          padding: '0 14px',
          overflow: 'hidden',
        }}
      >
        {favoriteOpenItems.map(({ venue, statusInfo }, i) => (
          <div
            key={venue.id}
            style={{ borderBottom: i < favoriteOpenItems.length - 1 ? '1px solid var(--tj-line)' : 'none' }}
          >
            <OpenRow venue={venue} statusInfo={statusInfo} onVenueClick={onVenueClick} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export default function CafeteriaVenues({ onVenueClick = () => {} }) {
  const isDark = useAppStore((s) => s.darkMode)
  const nowMs = useNow(60_000)   // 1분 단위 갱신
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  const [activeTab, setActiveTab] = useState('now')   // 기본: 지금 영업중
  const [sortBy, setSortBy] = useState('building')    // 기본: 장소별

  const timeStr = kstTime(nowMs)
  const weekdayStr = kstWeekday(nowMs)

  // 지금 영업중 개수 (탭 서브라벨용)
  const openCount = useMemo(
    () => ALL_VENUES.filter((v) => isOpenNow(v, nowDate).open).length,
    [nowDate]
  )

  return (
    <div>
      {/* 섹션 헤더 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          padding: '0 2px',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--tj-ink)' }}>
          학식 운영 정보
        </h2>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tj-mute)' }}>
          지금 <b style={{ color: 'var(--tj-accent-ink)', fontWeight: 800 }}>{timeStr}</b> · {weekdayStr}
        </span>
      </div>

      {/* 즐겨찾기 · 지금 영업 중 (즐겨찾기가 없거나 전부 닫혀 있으면 자동 숨김) */}
      <FavoriteOpenSection nowDate={nowDate} onVenueClick={onVenueClick} />

      {/* 탭 + 정렬 스위치 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* 주 탭 (지금 영업중 / 운영시간) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <SegmentTabs
              items={TABS}
              active={activeTab}
              onChange={setActiveTab}
            />
          </div>

          {/* 정렬 스위치 — 장소별 / 카테고리별 */}
          <div
            role="group"
            aria-label="정렬 방식"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              background: 'var(--tj-surface-2, var(--tj-line))',
              borderRadius: 10,
              padding: '3px',
              flexShrink: 0,
            }}
          >
            {SORT_OPTIONS.map((opt) => {
              const isActive = sortBy === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  aria-pressed={isActive}
                  style={{
                    minHeight: 44,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 800 : 600,
                    letterSpacing: '-0.01em',
                    background: isActive ? (isDark ? 'var(--tj-accent)' : 'var(--tj-ink)') : 'transparent',
                    color: isActive ? (isDark ? '#06201E' : '#fff') : 'var(--tj-ink-2)',
                    transition: 'background 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'now' && (
          <p style={{ fontSize: 13, color: 'var(--tj-mute)', fontWeight: 600, marginTop: 8, letterSpacing: '-0.01em' }}>
            {weekdayStr} 이 시각,{' '}
            <b style={{ color: 'var(--tj-ink-2)' }}>영업 중인 {openCount}곳</b>이에요
          </p>
        )}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'now' ? (
        <NowOpenTab sortBy={sortBy} nowDate={nowDate} onVenueClick={onVenueClick} />
      ) : (
        <ScheduleTab sortBy={sortBy} nowDate={nowDate} onVenueClick={onVenueClick} />
      )}
    </div>
  )
}
