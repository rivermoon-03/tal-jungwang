/**
 * CafeteriaPCLayout.jsx — /cafeteria PC 전폭 콘텐츠
 *
 * 예전엔 좌측 CafeteriaVenueRail(식당 카드 세로 목록, 300px 고정폭)을 별도
 * 컬럼으로 두고 있었지만, 전역 PCSidebar가 컨텍스트 서브내비(식단/운영정보)를
 * 맡게 되면서 이 rail은 PCSidebar와 중복되는 세 번째 컬럼이 됐다. 이제
 * mainTab은 store(useAppStore.pcCafeteriaTab)가 단일 출처이고, 식당(venue)
 * 선택만 이 컴포넌트 안에서 전폭 가로 chips로 처리한다.
 *
 * 데이터 훅(useCafeteriaMenu)은 호출부(CafeteriaPage)가 그대로 넘겨준다 —
 * 이 컴포넌트는 표시 레이아웃만 담당한다.
 */
import { useMemo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import MealGridSection from './MealGridSection'
import CafeteriaVenues from './CafeteriaVenues'
import useAppStore from '../../stores/useAppStore'
import { useNow } from '../../hooks/useNow'
import { formatUpdated } from '../../utils/cafeteriaFormat'
import { isMealTypeOpenNow, getCafeteriaStatus, isCafeteriaStatusOpen } from '../../utils/cafeteriaMenuVenue'
import {
  buildDayLabelMap,
  getTodayDayKey,
  getFirstDayKey,
  extractDayKeys,
  isKstWeekend,
  hasDayMenu,
  getNearestMenuDayKey,
} from '../../utils/cafeteriaDays'

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

/** 운영상태 pill — CafeteriaVenueRail의 StatusPill과 동일한 표시 규칙(unknown이면 숨김). */
function StatusPill({ status, primaryLabel }) {
  if (status === 'unknown') return null
  const isOpen = isCafeteriaStatusOpen(status)
  return (
    <span
      className={[
        'inline-flex items-center justify-center flex-shrink-0',
        'px-2 py-0.5 rounded-pill text-caption font-semibold whitespace-nowrap',
        isOpen ? 'bg-chip-green-bg text-chip-green-fg' : 'bg-chip-red-bg text-chip-red-fg',
      ].join(' ')}
    >
      {isOpen ? '운영 중' : (primaryLabel || '운영 종료')}
    </span>
  )
}

/** 식당 선택 — 가로 chips. 세로 rail(300px 컬럼) 대신 전폭 콘텐츠 상단에 둔다. */
function VenueChip({ name, isSelected, onSelect, nowDate }) {
  const status = getCafeteriaStatus(name, nowDate)
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onSelect}
      className={[
        'inline-flex items-center gap-2 flex-shrink-0',
        'h-[42px] px-4 rounded-pill border',
        'text-label font-semibold whitespace-nowrap select-none',
        'transition-colors duration-press',
        isSelected
          ? 'border-accent bg-accent-bg text-accent-ink'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
      ].join(' ')}
      style={{ touchAction: 'manipulation' }}
    >
      {name}
      <StatusPill status={status.status} primaryLabel={status.primaryLabel} />
    </button>
  )
}

export default function CafeteriaPCLayout({ data, loading, error, refetch }) {
  // 1분 주기 tick — CafeteriaVenues.jsx와 동일 패턴(useNow가 visibility 정리 담당).
  const nowMs = useNow(60_000)
  const nowDate = useMemo(() => new Date(nowMs), [nowMs])

  // mainTab(식단/운영정보)의 단일 출처는 store다(PCSidebar 컨텍스트 서브내비와
  // 공유). store 필드가 없는 환경(단독 렌더 테스트 등)에서는 로컬 상태로
  // 자연히 폴백한다 — MorePCLayout.pcMoreNav와 동일한 패턴.
  // mainTab 전환 UI(구 상단 세그먼트)는 PCSidebar 컨텍스트 서브내비로 이관돼
  // 이 컴포넌트 안에는 더 이상 스위처가 없다 — store 값을 그대로 읽기만 한다.
  // store 필드가 없는 환경(단독 렌더 테스트 등)에서는 기본값 'diet'로 폴백한다.
  const pcCafeteriaTab = useAppStore((s) => s.pcCafeteriaTab)
  const mainTab = pcCafeteriaTab ?? 'diet'

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
      {mainTab === 'venues' ? (
        <div className="flex-1 min-h-0 overflow-y-auto bg-bg px-8 py-6">
          <div className="max-w-[900px] mx-auto">
            <CafeteriaVenues onVenueClick={navigateToVenueDetail} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto bg-bg px-8 py-6">
          <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
            {/* 상단: 갱신 시각 + 식당 선택 chips(전폭 가로 — 예전 좌측 rail 대체) */}
            <div>
              {updatedLabel && <p className="mb-2 text-caption text-mute">{updatedLabel}</p>}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {(data?.cafeterias ?? []).map((c, idx) => (
                  <VenueChip
                    key={c.name}
                    name={c.name}
                    isSelected={idx === selectedVenueIdx}
                    onSelect={() => handleSelectVenue(idx)}
                    nowDate={nowDate}
                  />
                ))}
              </div>
            </div>

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
