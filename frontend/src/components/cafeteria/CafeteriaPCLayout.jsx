/**
 * CafeteriaPCLayout.jsx — /cafeteria PC 2열 레이아웃
 *
 * 좌측 CafeteriaVenueRail(식당 목록) + 우측 상세(요일 칩 + 끼니 그리드).
 * 데이터 훅(useCafeteriaMenu)은 호출부(CafeteriaPage)가 그대로 넘겨준다 —
 * 이 컴포넌트는 표시 레이아웃만 담당한다.
 */
import { useMemo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import MealGridSection from './MealGridSection'
import CafeteriaVenueRail from './CafeteriaVenueRail'
import CafeteriaVenues from './CafeteriaVenues'
import SegmentTabs from '../common/SegmentTabs'
import { useNow } from '../../hooks/useNow'
import { formatUpdated } from '../../utils/cafeteriaFormat'
import { isMealTypeOpenNow } from '../../utils/cafeteriaMenuVenue'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
} from '../../utils/cafeteriaDays'

// 상단 메인 탭: 식단(diet) / 운영정보(venues) — 모바일 CafeteriaPage.jsx와 동일 구성.
// 메뉴 API가 NO_MENU 등으로 실패해도(주말·방학) 운영정보는 정적 데이터 기반이라
// 항상 접근 가능해야 한다 — 이게 이 탭을 data/error와 무관하게 항상 렌더하는 이유.
const MAIN_TABS = [
  { id: 'diet', label: '식단' },
  { id: 'venues', label: '운영정보' },
]

function navigateToVenueDetail(venueId) {
  window.history.pushState(null, '', `/cafeteria/${encodeURIComponent(venueId)}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** 끼니 카드가 "지금" 운영 중일 때 헤더에 붙는 작은 pill */
function NowBadge() {
  return (
    <span className="ml-auto px-2 py-0.5 rounded-pill text-caption font-semibold bg-chip-green-bg text-chip-green-fg">
      지금
    </span>
  )
}

export default function CafeteriaPCLayout({ data, loading, error, refetch }) {
  // 1분 주기 tick — CafeteriaVenues.jsx와 동일 패턴(useNow가 visibility 정리 담당).
  const nowMs = useNow(60_000)
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  const [mainTab, setMainTab] = useState('diet')
  const [selectedVenueIdx, setSelectedVenueIdx] = useState(0)
  const [selectedDay, setSelectedDay] = useState(null)

  const updatedLabel = formatUpdated(data?.fetched_at)

  const cafeteriaForDays = data?.cafeterias?.[selectedVenueIdx] ?? null

  const dayKeys = useMemo(() => extractDayKeys(cafeteriaForDays), [cafeteriaForDays])

  const dayLabelMap = useMemo(
    () => buildDayLabelMap(data?.week_start, data?.year, dayKeys),
    [data?.week_start, data?.year, dayKeys]
  )

  // 오늘 자동 선택 + 폴백 — 모바일 CafeteriaPage.jsx와 동일 로직.
  const effectiveDay = useMemo(() => {
    if (selectedDay && dayKeys.includes(selectedDay)) return selectedDay
    const today = getTodayDayKey(data?.week_start, data?.year, dayKeys)
    if (today && hasDayMenu(cafeteriaForDays, today)) return today
    const nearest = getNearestMenuDayKey(data?.week_start, data?.year, dayKeys, cafeteriaForDays)
    if (nearest) return nearest
    return getFirstDayKey(dayKeys)
  }, [selectedDay, dayKeys, data?.week_start, data?.year, cafeteriaForDays])

  const cafeteria = data?.cafeterias?.[selectedVenueIdx] ?? null

  const dayChipItems = useMemo(
    () =>
      dayKeys.map((dk) => ({
        id: dk,
        label: dayLabelMap[dk] ?? `${dk}일`,
        hasMenu: hasDayMenu(cafeteriaForDays, dk),
      })),
    [dayKeys, dayLabelMap, cafeteriaForDays]
  )

  function handleSelectVenue(idx) {
    setSelectedVenueIdx(idx)
    setSelectedDay(null)
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-surface">
      {/* 메인 탭 — 식단/운영정보. 메뉴 데이터 로딩·에러와 무관하게 항상 표시한다. */}
      <div className="flex-shrink-0 border-b border-line px-8 py-3">
        <div className="w-[220px]">
          <SegmentTabs tabs={MAIN_TABS} active={mainTab} onChange={setMainTab} />
        </div>
      </div>

      {mainTab === 'venues' ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-bg px-8 py-6">
          <div className="max-w-[900px] mx-auto">
            <CafeteriaVenues onVenueClick={navigateToVenueDetail} />
          </div>
        </div>
      ) : (
      <div className="flex-1 min-h-0 flex overflow-hidden">
      <div className="w-[300px] xl:w-[340px] flex-shrink-0 h-full border-r border-line">
        <CafeteriaVenueRail
          cafeterias={data?.cafeterias ?? []}
          updatedLabel={updatedLabel}
          selectedIdx={selectedVenueIdx}
          onSelect={handleSelectVenue}
          nowDate={nowDate}
        />
      </div>

      <div className="flex-1 min-w-0 h-full overflow-y-auto px-8 py-8 bg-bg">
        {/* 로딩 스켈레톤 */}
        {loading && !data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-card bg-surface-2 animate-pulse" />
            ))}
          </div>
        )}

        {/* NO_MENU 에러 — 주말/평일 분기 (모바일과 동일 조건) */}
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

        {/* 기타 에러 */}
        {error && !data && error.code !== 'NO_MENU' && (
          <ErrorState message="식단표를 불러오지 못했어요" onRetry={refetch} />
        )}

        {/* 데이터 없음 */}
        {!loading && !error && data && (!cafeteria || cafeteria.meals.length === 0) && (
          <EmptyState title="현재 등록된 식단이 없어요" />
        )}

        {/* 상세: 요일 칩 + 끼니 그리드 */}
        {cafeteria && effectiveDay && (
          <div key={`${selectedVenueIdx}:${effectiveDay}`} className="animate-fade-in">
            {/* 헤더 행: 식당명 + 우측 정렬 요일 칩 */}
            <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
              <h2 className="text-head font-bold text-ink">{cafeteria.name} 식단</h2>

              {dayChipItems.length > 0 && (
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
              )}
            </div>

            {/* 끼니 그리드 — "지금" 운영 중인 끼니는 강조 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {cafeteria.meals.map((meal, i) => {
                const isNow = isMealTypeOpenNow(cafeteria.name, meal.type, nowDate)
                return (
                  <div
                    key={`${meal.type}-${i}`}
                    className={[
                      'bg-surface border rounded-card p-4',
                      isNow ? 'border-accent' : 'border-line',
                    ].join(' ')}
                  >
                    <MealGridSection
                      meal={meal}
                      dayKey={effectiveDay}
                      badge={isNow ? <NowBadge /> : null}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      </div>
      )}
    </div>
  )
}
