/**
 * CafeteriaVenues.jsx — 매장 운영 정보 컴포넌트(매장 탭)
 *
 * 탭 구조:
 *   [지금 영업중 | 운영시간] — 기본 "지금 영업중"
 *
 * 시안1: 식당별 조/중/석 + 운영중 배지 (운영시간 탭)
 * 시안2: 현재 시각 기준 영업중 필터 목록 (지금 영업중 탭, 기본)
 *
 * 시안2 "다정한 카드" 카드 해부(단일 규격, 모든 목록 공통):
 *   [타일 56px] [이름 + 메타(위치·시간) + 대표메뉴 태그] [상태 pill]
 * 예전에는 RestaurantCard(학식, 끼니별 시간표 포함) / SimpleVenueCard(단순
 * 시간대) / OpenRow(지금 영업중 행) 세 가지가 패딩·반경·필드 순서까지
 * 제각각이었다 — 같은 매점이 탭만 바꿔도 다른 모양으로 보였다. VenueCard
 * 하나로 합치고, 세부 시간표(조/중/석 각각의 시작~끝) 대신 대표 시간 범위와
 * 대표메뉴 태그로 요약한다 — 상세 시간표는 상세 페이지(/cafeteria/:id) 몫이다.
 *
 * 디자인 규칙:
 *   - 좌측 색상 테두리 없음, 이모지 없음
 *   - 영업중/마감임박: 텍스트 + 의미색 (점 없음)
 *   - 본문 글자 >= 15px (text-body)
 *   - 다크모드 정상 지원
 */
import { createElement, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import useAppStore from '../../stores/useAppStore'
import { ALL_VENUES, BUILDING_GROUPS, CATEGORY_GROUPS } from '../../data/cafeteriaVenues'
import { isOpenNow, getVenueBuilding, getBuildingColor, getCategoryStyle, getCategoryIcon } from '../../utils/venueOpen'
import SegmentTabs from '../ui/SegmentTabs'
import IconButton from '../ui/IconButton'
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

// ── 카드 대표 시간 요약 헬퍼 ─────────────────────────────────
/** venue의 meals/hours/schedule 중 첫 시작 ~ 마지막 종료를 한 범위로 요약한다.
 * "HH:MM" 문자열은 앞자리가 0으로 채워져 있어 사전식 정렬이 시간 정렬과 같다. */
function getVenueTimeLabel(venue) {
  if (venue.alwaysOpen || venue.is24h) return '24시간 운영'
  const slots = venue.meals ?? venue.hours ?? venue.schedule?.semester?.weekday ?? []
  if (slots.length === 0) return ''
  const starts = slots.map((s) => s.start).sort()
  const ends = slots.map((s) => s.end).sort()
  return `${starts[0]}~${ends[ends.length - 1]}`
}

// ── 카테고리 타일 (카드 좌측 56px 썸네일 자리) ────────────────
function CategoryTile({ category }) {
  const { color, bg } = getCategoryStyle(category)
  const Icon = getCategoryIcon(category)
  return (
    <div
      className="flex-none w-14 h-14 rounded-tile flex items-center justify-center"
      style={{ background: bg }}
    >
      {createElement(Icon, { size: 24, strokeWidth: 2, color })}
    </div>
  )
}

// ── 카테고리 아이콘 원형 칩 (그룹 헤더 전용, 작은 사이즈) ─────
function CategoryHeaderIcon({ category }) {
  const { color, bg } = getCategoryStyle(category)
  const Icon = getCategoryIcon(category)
  return (
    <div
      className="flex-none w-6 h-6 rounded-full flex items-center justify-center"
      style={{ background: bg }}
    >
      {createElement(Icon, { size: 13, strokeWidth: 2.2, color })}
    </div>
  )
}

// ── 건물별 위치 칩 ────────────────────────────────────────
function LocationChip({ location }) {
  const building = getVenueBuilding(location)
  const { color, bg } = getBuildingColor(building)
  return (
    // "TIP 1F"가 "TIP / 1F"로 줄바꿈되던 문제 — 위치 라벨은 항상 한 줄.
    <span
      className="inline-block flex-shrink-0 whitespace-nowrap text-caption font-bold rounded-badge px-[7px] py-[2px] leading-[1.5] tracking-[-0.01em]"
      style={{ color, background: bg }}
    >
      {location}
    </span>
  )
}

// ── 대표메뉴 태그 칩 ─────────────────────────────────────────
// venue.menu 최대 3개 + 나머지는 "+N"으로 뭉친다 — 태그가 많으면 카드 높이가
// 목록마다 들쭉날쭉해진다.
const MENU_TAG_LIMIT = 3

function MenuTags({ menu }) {
  if (!Array.isArray(menu) || menu.length === 0) return null
  const shown = menu.slice(0, MENU_TAG_LIMIT)
  const overflow = menu.length - shown.length

  return (
    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
      {shown.map((item) => (
        <span
          key={item}
          className="text-caption font-semibold text-ink-2 bg-surface-2 rounded-pill px-2 py-0.5"
        >
          {item}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-caption font-semibold text-mute bg-surface-2 rounded-pill px-2 py-0.5">
          +{overflow}
        </span>
      )}
    </div>
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

// ── F2: 매점/식당 즐겨찾기 별 버튼 (카드 공통) ────────────────
function FavoriteStarButton({ venueId, size = 15 }) {
  const isFav = useAppStore(
    (s) => Array.isArray(s.favorites?.venues) && s.favorites.venues.includes(venueId)
  )
  const toggleFavoriteVenue = useAppStore((s) => s.toggleFavoriteVenue)

  return (
    <IconButton
      label={isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      aria-pressed={isFav}
      variant="surface"
      size="md"
      // 즐겨찾기 on일 때만 노란 칩 톤으로 덮어쓴다. Tailwind 클래스 소스 순서에
      // 기대지 않도록 !important 변형자로 surface 톤 위에 확정적으로 얹는다.
      className={isFav ? '!bg-chip-yellow-bg !text-chip-yellow-fg' : ''}
      onClick={(e) => {
        // 카드 자체도 클릭 가능(role=button)하므로 버블링으로 상세 이동이
        // 함께 트리거되지 않도록 막는다.
        e.stopPropagation()
        if (typeof toggleFavoriteVenue === 'function') toggleFavoriteVenue(venueId)
      }}
    >
      {/* 미즐겨찾기는 빈 별로 둔다. StarOff(사선 그어진 별)는 "즐겨찾기를 끌 수
          없음"처럼 읽히고, 시간표 화면이 쓰는 빈 별 관례와도 어긋났다. */}
      <Star size={size} strokeWidth={2} fill={isFav ? 'currentColor' : 'none'} />
    </IconButton>
  )
}

// ── 통합 매장 카드 (시안2 "다정한 카드" 해부) ─────────────────
function VenueCard({ venue, nowDate, onVenueClick, style }) {
  const { status, primaryLabel, subLabel } = isOpenNow(venue, nowDate)
  const timeLabel = getVenueTimeLabel(venue)

  return (
    <div
      role="button"
      aria-label={venue.name}
      tabIndex={0}
      onClick={() => onVenueClick(venue.id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onVenueClick(venue.id) }}
      className="tj-card-enter flex items-start gap-3 bg-surface rounded-card shadow-sh-card p-[18px] cursor-pointer min-h-[44px]"
      style={style}
    >
      <CategoryTile category={venue.category} />

      <div className="flex-1 min-w-0">
        <div className="text-head font-bold text-ink truncate">{venue.name}</div>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          <LocationChip location={venue.location} />
          {timeLabel && (
            <span className="text-caption font-semibold text-mute whitespace-nowrap">
              {timeLabel}
            </span>
          )}
        </div>
        <MenuTags menu={venue.menu} />
      </div>

      <div className="flex-none flex flex-col items-end gap-2">
        <div className="text-right">
          <StatusPill primaryLabel={primaryLabel} status={status} />
          {subLabel && (
            <div className="mt-1 text-caption font-semibold text-mute whitespace-nowrap">
              {subLabel}
            </div>
          )}
        </div>
        <FavoriteStarButton venueId={venue.id} />
      </div>
    </div>
  )
}

// ── 카드 그리드 — PC 2~3열, 모바일 1열. 구분선 대신 여백(gap)으로 카드를 나눈다 ──
function VenueCardGrid({ venues, nowDate, onVenueClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {venues.map((venue, i) => (
        <VenueCard
          key={venue.id}
          venue={venue}
          nowDate={nowDate}
          onVenueClick={onVenueClick}
          style={staggerStyle(i)}
        />
      ))}
    </div>
  )
}

// ── 그룹 헤더 — 건물별 ──────────────────────────────────────
function BuildingGroupHeader({ building }) {
  const { color, bg } = getBuildingColor(building)
  return (
    <div className="flex items-center gap-2 mb-2">
      <span
        className="text-caption font-extrabold rounded-badge px-2.5 py-[3px] tracking-[-0.02em]"
        style={{ color, background: bg }}
      >
        {building}
      </span>
      <span className="flex-1 h-px bg-line" />
    </div>
  )
}

// ── 그룹 헤더 — 카테고리별 ──────────────────────────────────
function CategoryGroupHeader({ category }) {
  const { color, bg } = getCategoryStyle(category)
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className="flex items-center gap-1.5 rounded-badge px-2.5 py-[3px]"
        style={{ background: bg }}
      >
        <CategoryHeaderIcon category={category} />
        <span className="text-caption font-extrabold tracking-[-0.02em]" style={{ color }}>
          {category}
        </span>
      </div>
      <span className="flex-1 h-px bg-line" />
    </div>
  )
}

/** 운영시간 탭 — 정렬 스위치 적용. 한 카드 규격을 그룹(건물/카테고리)별로 나눠 보여준다. */
function ScheduleTab({ sortBy, nowDate, onVenueClick }) {
  const groups = sortBy === 'building' ? BUILDING_GROUPS : CATEGORY_GROUPS

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.key}>
          {sortBy === 'building' ? (
            <BuildingGroupHeader building={group.label} />
          ) : (
            <CategoryGroupHeader category={group.label} />
          )}
          <VenueCardGrid venues={group.venues} nowDate={nowDate} onVenueClick={onVenueClick} />
        </div>
      ))}
    </div>
  )
}

// ── 시안2: 지금 영업중 탭 ─────────────────────────────────────

/** 지금 영업중 탭 */
function NowOpenTab({ sortBy, nowDate, onVenueClick }) {
  const openVenues = useMemo(
    () => ALL_VENUES.filter((v) => isOpenNow(v, nowDate).open),
    [nowDate]
  )

  if (openVenues.length === 0) {
    return (
      <div className="py-10 px-4 text-center text-body font-semibold text-mute">
        지금 영업 중인 곳이 없어요
      </div>
    )
  }

  // 장소별 그룹핑
  if (sortBy === 'building') {
    const buildingOrder = ['TIP', 'E동', '중앙도서관']
    const groups = buildingOrder
      .map((b) => ({
        building: b,
        venues: openVenues.filter((v) => (v.building ?? getVenueBuilding(v.location)) === b),
      }))
      .filter((g) => g.venues.length > 0)

    return (
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.building}>
            <BuildingGroupHeader building={group.building} />
            <VenueCardGrid venues={group.venues} nowDate={nowDate} onVenueClick={onVenueClick} />
          </div>
        ))}
      </div>
    )
  }

  // 카테고리별 그룹핑
  const categoryOrder = ['한식', '분식', '중식', '양식', '패스트푸드', '카페', '편의점']
  const catGroups = categoryOrder
    .map((c) => ({ category: c, venues: openVenues.filter((v) => v.category === c) }))
    .filter((g) => g.venues.length > 0)

  // 카테고리별 그룹핑이 없으면 단순 그리드
  if (catGroups.length === 0) {
    return <VenueCardGrid venues={openVenues} nowDate={nowDate} onVenueClick={onVenueClick} />
  }

  return (
    <div className="flex flex-col gap-5">
      {catGroups.map((group) => (
        <div key={group.category}>
          <CategoryGroupHeader category={group.category} />
          <VenueCardGrid venues={group.venues} nowDate={nowDate} onVenueClick={onVenueClick} />
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

  const favoriteOpenVenues = useMemo(() => {
    if (!favoriteVenueIds.length) return []
    return ALL_VENUES.filter(
      (v) => favoriteVenueIds.includes(v.id) && isOpenNow(v, nowDate).open
    )
  }, [favoriteVenueIds, nowDate])

  if (favoriteOpenVenues.length === 0) return null

  return (
    <div data-testid="favorite-open-section" className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center gap-[5px] text-caption font-extrabold text-chip-yellow-fg bg-chip-yellow-bg rounded-badge px-2.5 py-[3px]">
          <Star size={13} strokeWidth={2} fill="currentColor" />
          즐겨찾기 · 지금 영업 중
        </span>
        <span className="flex-1 h-px bg-line" />
      </div>
      <VenueCardGrid venues={favoriteOpenVenues} nowDate={nowDate} onVenueClick={onVenueClick} />
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export default function CafeteriaVenues({ onVenueClick = () => {} }) {
  const isDark = useAppStore((s) => s.darkMode)
  const nowMs = useNow(60_000)   // 1분 단위 갱신
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  const [activeTab, setActiveTab] = useState('now')       // 기본: 지금 영업중
  // 기본값을 '카테고리별'로 바꿨다 — 17곳 중 13곳이 TIP 건물이라 장소별
  // 그룹핑은 사실상 "TIP 한 덩어리 + 나머지 소수"로 나뉘어 그룹핑의 의미가
  // 없었다. 카테고리(한식/분식/중식/양식/패스트푸드/카페/편의점)는 7개 그룹이
  // 고르게 나뉘어 "뭘 먹을지"를 고르는 실제 탐색 방식과 더 가깝다.
  const [sortBy, setSortBy] = useState('category')

  const timeStr = kstTime(nowMs)
  const weekdayStr = kstWeekday(nowMs)

  // 지금 영업중 개수 (탭 서브라벨용)
  const openCount = useMemo(
    () => ALL_VENUES.filter((v) => isOpenNow(v, nowDate).open).length,
    [nowDate]
  )

  return (
    <div>
      {/* 섹션 헤더. 결함 #15: 이 컴포넌트는 [학식|매장|도서관] 중 "매장" 탭에서
          렌더되는데 제목이 "학식 운영 정보"였다. 바로 위 탭이 "매장"으로 표시된
          상태라 제목만 학식으로 남아 어긋났다. 목록도 라온식당, 수호식당 같은
          식당과 카페, 편의점 같은 매장이 섞여 있어 "매장"이 실제 내용과 맞다. */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h2 className="text-title text-ink tracking-[-0.03em]">매장 운영 정보</h2>
        <span className="text-caption font-semibold text-mute">
          지금 <b className="text-accent-ink font-extrabold">{timeStr}</b> · {weekdayStr}
        </span>
      </div>

      {/* 즐겨찾기 · 지금 영업 중 (즐겨찾기가 없거나 전부 닫혀 있으면 자동 숨김) */}
      <FavoriteOpenSection nowDate={nowDate} onVenueClick={onVenueClick} />

      {/* 탭 + 정렬 스위치 */}
      <div className="mb-3.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 주 탭 (지금 영업중 / 운영시간)
              maxWidth 없이 flex:1만 두면 PC에서 버튼 하나가 460px까지 늘어난다.
              결함 #8: minWidth:0이면 좁은 폭에서 정렬 스위치와 한 줄을 다투다
              라벨이 찌그러졌다 — 두 라벨이 읽히는 최소폭을 줘서, 공간이 부족하면
              스위치 그룹이 아예 다음 줄로 깔끔하게 내려가게(의도된 2줄) 한다. */}
          <div className="flex-1 min-w-[180px] max-w-[420px]">
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
            className="flex items-center gap-0.5 rounded-button p-[3px] flex-shrink-0"
            style={{ background: 'var(--tj-surface-2, var(--tj-line))' }}
          >
            {SORT_OPTIONS.map((opt) => {
              const isActive = sortBy === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  aria-pressed={isActive}
                  className={[
                    'min-h-[44px] px-3 rounded-badge border-none cursor-pointer',
                    'text-caption whitespace-nowrap transition-colors duration-press',
                    isActive ? 'font-extrabold' : 'font-semibold',
                  ].join(' ')}
                  style={{
                    background: isActive ? (isDark ? 'var(--tj-accent)' : 'var(--tj-ink)') : 'transparent',
                    // active 배경(라이트: ink=거의 검정, 다크: accent=밝은 틸) 위에서
                    // 대비를 맞추려면 반대쪽 극단의 텍스트가 필요하다 — 전용 토큰은 없지만
                    // --tj-bg가 라이트에서 거의 흰색, 다크에서 거의 검정이라 그대로 재사용하면
                    // hex를 하드코딩하지 않고도 두 모드 모두에서 대비가 맞는다.
                    color: isActive ? 'var(--tj-bg)' : 'var(--tj-ink-2)',
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        {activeTab === 'now' && (
          <p className="mt-2 text-caption font-semibold text-mute">
            {weekdayStr} 이 시각,{' '}
            <b className="text-ink-2 font-extrabold">영업 중인 {openCount}곳</b>이에요
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
