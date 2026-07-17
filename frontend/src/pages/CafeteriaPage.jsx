/**
 * CafeteriaPage — /cafeteria 페이지 (학식)
 * 백엔드 형식: week_start, year, fetched_at, cafeterias[{ name, meals[{ type, time, by_day }] }]
 *
 * 상단 메인 탭: [식단 | 운영정보]
 *   - 식단: 시안1 메뉴 그리드 레이아웃
 *   - 운영정보: CafeteriaVenues 컴포넌트
 */
import { useMemo, useState } from 'react'
import PageHeader from '../components/layout/PageHeader'
import SegmentTabs from '../components/common/SegmentTabs'
import StationChips from '../components/ui/StationChips'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import CafeteriaVenues from '../components/cafeteria/CafeteriaVenues'
import { useCafeteriaMenu } from '../hooks/useCafeteria'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
} from '../utils/cafeteriaDays'

// 메인 탭 정의
const MAIN_TABS = [
  { id: 'diet', label: '식단' },
  { id: 'venues', label: '운영정보' },
]

/**
 * fetched_at ISO → "HH:MM 갱신" 문자열
 */
function formatUpdated(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mi} 갱신`
}

/**
 * 빈 메뉴 여부 판정 — 빈 배열 또는 ["미운영"] 단독
 */
function isEmptyMenu(items) {
  if (!items || items.length === 0) return true
  if (items.length === 1 && items[0] === '미운영') return true
  return false
}

/**
 * 시안1: 카드 그리드 메뉴 섹션
 * 메인 메뉴(앞 2개)는 강조 타일, 나머지는 일반 타일
 */
function MealGridSection({ meal, dayKey }) {
  const rawItems = meal.by_day?.[dayKey] ?? []
  const empty = isEmptyMenu(rawItems)
  const menuItems = empty ? [] : rawItems

  return (
    <div className="mb-5">
      {/* 섹션 헤더: type + time */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-[17px] font-extrabold text-ink leading-tight">
          {meal.type}
        </span>
        {meal.time && (
          <span className="text-[13px] text-mute">{meal.time}</span>
        )}
      </div>

      {/* 빈 상태 */}
      {empty ? (
        <p className="text-body text-mute py-2">오늘은 운영하지 않아요</p>
      ) : (
        <div
          data-testid="menu-grid"
          className="grid grid-cols-2 gap-[10px]"
        >
          {menuItems.map((item, i) => {
            const isMain = i < 2
            return (
              <div
                key={`${item}-${i}`}
                className={[
                  'rounded-card px-[14px] py-4 flex items-center min-h-[64px]',
                  isMain
                    ? 'bg-accent-bg border border-accent-bg'
                    : 'bg-surface border border-line',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-[16px] leading-snug',
                    isMain
                      ? 'font-extrabold text-accent'
                      : 'font-semibold text-ink',
                  ].join(' ')}
                >
                  {item}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function CafeteriaPage() {
  const { data, loading, error, refetch } = useCafeteriaMenu()

  // 메인 탭: 식단(diet) / 운영정보(venues)
  const [mainTab, setMainTab] = useState('venues')

  const [selectedCafeteriaIdx, setSelectedCafeteriaIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  // 첫 번째 cafeteria 기준으로 dayKeys 추출
  const cafeteriaForDays = data?.cafeterias?.[selectedCafeteriaIdx] ?? null

  const dayKeys = useMemo(
    () => extractDayKeys(cafeteriaForDays),
    [cafeteriaForDays]
  )

  // 요일 라벨 맵 구성
  const dayLabelMap = useMemo(
    () => buildDayLabelMap(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  // 오늘 자동 선택 (KST 기준)
  // 오늘에 메뉴가 없으면 가장 가까운 메뉴 있는 날로 폴백.
  const effectiveDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay
    const today = getTodayDayKey(data?.week_start, data?.year, dayKeys)
    if (today && hasDayMenu(cafeteriaForDays, today)) return today
    // 오늘 메뉴 없거나 오늘이 dayKeys에 없는 경우: 가장 가까운 메뉴 있는 날
    const nearest = getNearestMenuDayKey(data?.week_start, data?.year, dayKeys, cafeteriaForDays)
    if (nearest) return nearest
    // 메뉴 있는 날이 하나도 없으면 첫 번째 날 표시 (미운영 안내라도 보여줌)
    return getFirstDayKey(dayKeys)
  }, [selectedDay, dayKeys, data?.week_start, data?.year, cafeteriaForDays])

  const cafeteria = data?.cafeterias?.[selectedCafeteriaIdx] ?? null
  const updatedLabel = formatUpdated(data?.fetched_at)

  // 식당 세그먼트 탭 items
  const cafeteriaTabItems = useMemo(
    () =>
      (data?.cafeterias ?? []).map((c, i) => ({
        id: String(i),
        label: c.name,
      })),
    [data?.cafeterias]
  )

  // 요일 칩 items (hasMenu: 해당 날 메뉴 존재 여부)
  const dayChipItems = useMemo(
    () =>
      dayKeys.map((dk) => ({
        id: dk,
        label: dayLabelMap[dk] ?? `${dk}일`,
        hasMenu: hasDayMenu(cafeteriaForDays, dk),
      })),
    [dayKeys, dayLabelMap, cafeteriaForDays]
  )

  return (
    <div className="flex flex-col h-full bg-surface animate-fade-in-up">
      {/* 헤더는 에러여도 항상 표시 */}
      <PageHeader title="학식" />

      {/* 갱신 시각 */}
      {updatedLabel && (
        <p className="px-4 -mt-2 mb-2 text-caption text-mute">
          {updatedLabel}
        </p>
      )}

      {/* 메인 탭: 식단 / 운영정보 */}
      <div className="px-4 pb-3">
        <SegmentTabs
          tabs={MAIN_TABS}
          active={mainTab}
          onChange={setMainTab}
        />
      </div>

      {/* 식단 탭 */}
      {mainTab === 'diet' && (
        <>
          {/* 식당 세그먼트 탭 — 에러여도 data가 있으면 표시 */}
          {cafeteriaTabItems.length > 0 && (
            <div className="px-4 pb-2">
              <SegmentTabs
                tabs={cafeteriaTabItems}
                active={String(selectedCafeteriaIdx)}
                onChange={(id) => {
                  setSelectedCafeteriaIdx(Number(id))
                  setSelectedDay(null)
                }}
              />
            </div>
          )}

          {/* 요일 칩 — hasMenu 없는 날은 흐리게 표시 */}
          {dayChipItems.length > 0 && (
            <div className="px-4 pb-3 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-2 overflow-x-auto">
                {dayChipItems.map((item) => {
                  const isActive = item.id === effectiveDay
                  return (
                    <button
                      key={item.id}
                      aria-pressed={isActive}
                      data-has-menu={item.hasMenu ? 'true' : 'false'}
                      onClick={() => setSelectedDay(item.id)}
                      className={[
                        'inline-flex items-center justify-center',
                        'h-[38px] px-4 rounded-pill',
                        'text-label font-semibold whitespace-nowrap select-none',
                        'transition-colors duration-press',
                        isActive
                          ? 'bg-accent-bg text-accent-ink'
                          : item.hasMenu
                            ? 'bg-surface-2 text-ink-2'
                            : 'bg-surface-2 text-ink-2 opacity-40',
                      ].join(' ')}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 본문 */}
          <div className="flex-1 overflow-y-auto px-4 py-2 pb-28 md:pb-6">
            {/* 로딩 스켈레톤 */}
            {loading && !data && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-28 rounded-[16px] bg-surface-2 animate-pulse"
                  />
                ))}
              </div>
            )}

            {/* NO_MENU 에러 — 주말/평일 분기 */}
            {error && !data && error.code === 'NO_MENU' && (
              isKstWeekend() ? (
                <EmptyState
                  title="주말에는 학식을 운영하지 않아요"
                  desc="평일에 다시 확인해 주세요."
                />
              ) : (
                <EmptyState
                  title="지금은 등록된 식단이 없어요"
                  desc="방학 기간이거나 아직 식단이 올라오지 않았을 수 있어요."
                  action={{ label: '다시 확인', onClick: refetch }}
                />
              )
            )}

            {/* 기타 에러 — onRetry={refetch} 연결 */}
            {error && !data && error.code !== 'NO_MENU' && (
              <ErrorState
                message="식단표를 불러오지 못했어요"
                onRetry={refetch}
              />
            )}

            {/* 데이터 없음 */}
            {!loading && !error && data && (!cafeteria || cafeteria.meals.length === 0) && (
              <EmptyState title="현재 등록된 식단이 없어요" />
            )}

            {/* 시안1: 메뉴 그리드 섹션 */}
            {cafeteria && effectiveDay && (
              <div
                className="flex flex-col animate-fade-in"
                key={`${selectedCafeteriaIdx}:${effectiveDay}`}
              >
                {cafeteria.meals.map((meal, i) => (
                  <MealGridSection
                    key={`${meal.type}-${i}`}
                    meal={meal}
                    dayKey={effectiveDay}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* 운영정보 탭 */}
      {mainTab === 'venues' && (
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 md:pb-6">
          <CafeteriaVenues
            onVenueClick={(venueId) => {
              window.history.pushState(null, '', `/cafeteria/${encodeURIComponent(venueId)}`)
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          />
        </div>
      )}
    </div>
  )
}
